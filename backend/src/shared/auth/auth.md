# Better Auth + NestJS + Expo: guia completo em português

*Resumo detalhado e traduzido da documentação de `@thallesp/nestjs-better-auth`, com a configuração para Expo (login social) e Google One Tap. Pensado para o stack NestJS + Next.js + Expo.*

## 1. Quem faz o quê

| Peça | Papel |
| --- | --- |
| `better-auth` | Biblioteca de autenticação: sessões, email/password, providers sociais, plugins (admin, organization, 2FA...) |
| `@thallesp/nestjs-better-auth` | Integração com o Nest: monta as rotas `/api/auth/*`, regista um guard global, decorators, hooks com injeção de dependências e o `AuthService` |
| `@better-auth/expo` | Plugin para apps mobile: guarda a sessão no SecureStore e trata deep links |

Requisito: `better-auth` >= 1.5.0 (versões mais antigas estão deprecadas).

## 2. Instalação e setup básico

```bash
pnpm add @thallesp/nestjs-better-auth better-auth
```

**Passo 1: desativar o body parser do Nest**, para o Better Auth ler o corpo cru. A lib volta a adicionar os parsers para as rotas que não são de auth.

```ts
// main.ts
const app = await NestFactory.create(AppModule, { bodyParser: false });
```

Efeito colateral: com `bodyParser: false`, a opção `rawBody: true` do `NestFactory.create()` deixa de ter efeito. Se precisares de `req.rawBody` (por exemplo, assinatura de webhooks), ativa-o no módulo com `bodyParser.rawBody`.

**Passo 2: importar o módulo**

```ts
// app.module.ts
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth';

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: '2mb' },
        urlencoded: { limit: '2mb', extended: true },
        rawBody: true,
      },
    }),
  ],
})
export class AppModule {}
```

`bodyParser.json` e `bodyParser.urlencoded` aceitam as opções do parser mais a flag `enabled`, para desligar cada um individualmente.

## 3. Proteção de rotas

**Global por defeito.** O módulo regista um `AuthGuard` global: todas as rotas exigem sessão, a não ser que marques o contrário.

| Decorator | Efeito |
| --- | --- |
| `@AllowAnonymous()` | Rota pública, sem autenticação |
| `@OptionalAuth()` | Autenticação opcional: se houver sessão, vem preenchida; senão, `session` é nula |

Funcionam em método ou em classe (controller inteiro):

```ts
@AllowAnonymous()
@Controller('public')
export class PublicController {}

@Controller('users')
export class UserController {
  @Get('optional')
  @OptionalAuth()
  optional(@Session() session: UserSession) {
    return { authenticated: !!session };
  }
}
```

**GraphQL:** funciona igual ao REST. O guard global aplica-se aos resolvers e podes usar `@AllowAnonymous()` / `@OptionalAuth()` em queries e mutations.

**WebSocket:** os decorators funcionam, mas tens de aplicar o `AuthGuard` tu mesmo, no gateway ou por mensagem:

```ts
@WebSocketGateway({ path: '/ws', namespace: 'test' })
@UseGuards(AuthGuard)
export class TestGateway {}
```

**Desativar o guard global:** `AuthModule.forRoot({ auth, disableGlobalAuthGuard: true })`. Depois aplicas `@UseGuards(AuthGuard)` por controller/rota, ou registas via `APP_GUARD`.

## 4. Aceder à sessão e ao utilizador

```ts
@Get('me')
getProfile(@Session() session: UserSession) {
  return session; // { user, session }
}
```

Alternativa pelo objeto do pedido:

- `req.session`: objeto completo (utilizador + estado de autenticação)
- `req.user`: referência direta ao utilizador (útil para Sentry e observabilidade)

**`AuthService`:** injetável em qualquer provider. Dá acesso à API do Better Auth (`authService.api.*`), incluindo métodos de plugins. Passa sempre os headers do pedido com `fromNodeHeaders(req.headers)`, senão a API não sabe quem é o utilizador. Usa o genérico `AuthService<typeof auth>` para ter tipos dos métodos dos plugins (por exemplo `createApiKey`).

## 5. Roles e permissões (secção principal)

### 5.1 Dois níveis, cinco decorators

O Better Auth tem dois mundos separados: o **sistema** (plugin `admin`, campo `user.role`) e a **organização** (plugin `organization`, role do membro na organização ativa). A lib dá um decorator por cada necessidade:

| Decorator | O que verifica | Plugin |
| --- | --- | --- |
| `@Roles([...])` | Apenas `user.role` (role de sistema) | admin |
| `@RequireActiveOrg()` | Apenas que existe `activeOrganizationId` na sessão | organization |
| `@OrgRoles([...])` | Organização ativa + role do membro nessa organização | organization |
| `@UserHasPermission({...})` | Permissões de sistema (access control) | admin |
| `@MemberHasPermission({...})` | Permissões do membro na organização ativa | organization |

**Porque são separados:** para evitar escalada de privilégios. `@Roles()` **não** olha para roles de organização. Assim, um admin de uma organização nunca consegue passar numa rota reservada ao admin do sistema.

### 5.2 Configurar o access control no `auth.ts`

Roles simples (`admin`, `member`, `owner`) funcionam logo. Para permissões finas, defines recursos e ações com `createAccessControl`:

```ts
import { betterAuth } from 'better-auth';
import { admin as adminPlugin } from 'better-auth/plugins/admin';
import { organization } from 'better-auth/plugins/organization';
import { createAccessControl } from 'better-auth/plugins/access';

const statement = {
  project: ['create', 'share', 'update', 'delete'],
  sale: ['create', 'read', 'update', 'delete'],
  organization: ['update', 'delete'], // só necessário para o plugin organization
} as const;

const ac = createAccessControl(statement);

const editor = ac.newRole({ project: ['create', 'update'] });
const adminRole = ac.newRole({
  project: ['create', 'update', 'delete'],
  sale: ['create', 'read', 'update', 'delete'],
  organization: ['update'],
});

export const auth = betterAuth({
  plugins: [
    adminPlugin({ ac, roles: { editor, admin: adminRole } }),
    organization({ ac, roles: { editor, admin: adminRole } }),
  ],
});
```

Nota: na documentação original a variável chama-se `admin`, o que colide com o import do plugin. Aqui renomeei para `adminRole` / `adminPlugin`.

### 5.3 `@Roles()`: role de sistema

Só verifica `user.role`. Um admin de organização **não** passa.

```ts
@Roles(['admin'])
@Controller('admin')
export class AdminController {
  @Get('dashboard')
  dashboard() { return { message: 'Painel do admin do sistema' }; }
}
```

Podes usar em método ou em classe (todas as rotas ficam exigindo `user.role = 'admin'`).

### 5.4 `@RequireActiveOrg()`: só contexto de organização

Exige sessão e `session.activeOrganizationId`, mas **nenhuma role específica**. Serve para rotas que só precisam do ID da organização para filtrar dados, quando a autorização é tratada noutro sítio ou as roles são dinâmicas.

```ts
@RequireActiveOrg()
@Controller('projects')
export class ProjectsController {
  @Get()
  list(@Session() session: UserSession) {
    return { orgId: session.session.activeOrganizationId };
  }
}
```

### 5.5 `@OrgRoles()`: role dentro da organização

Exige organização ativa **e** que o membro tenha uma das roles indicadas.

```ts
@Controller('org')
export class OrgController {
  @OrgRoles(['owner', 'admin'])
  @Get('settings')
  settings(@Session() s: UserSession) {
    return { orgId: s.session.activeOrganizationId };
  }

  @OrgRoles(['owner'])
  @Get('billing')
  billing() { return { message: 'Só o owner' }; }
}
```

As roles são strings livres. O plugin traz `owner`, `admin` e `member` por defeito, e podes definir roles próprias. Quem cria a organização recebe `owner` automaticamente. Um admin do sistema **não** passa aqui sem contexto de organização.

### 5.6 `@UserHasPermission()`: permissões de sistema

Verifica permissões usando o access control do plugin `admin`.

```ts
@Controller('projects')
export class ProjectController {
  @UserHasPermission({ permission: { project: ['create', 'update'] } })
  @Post()
  create() { /* ... */ }

  @UserHasPermission({ permission: { project: ['delete'] } })
  @Post(':id/delete')
  remove() { /* ... */ }

  @UserHasPermission({ permissions: { project: ['create'], sale: ['create'] } })
  @Post('bundle')
  bundle() { /* exige as duas */ }
}
```

Opções:

- `permission`: uma verificação (ex.: `{ project: ['create', 'update'] }`)
- `permissions`: várias verificações em vários recursos
- `role` (**só servidor**): verifica as permissões de uma role específica
- `userId` (opcional): verifica outro utilizador (por defeito, o utilizador atual)

### 5.7 `@MemberHasPermission()`: permissões na organização

Verifica as permissões do **membro** na organização ativa, usando o access control do plugin `organization`. Exige `activeOrganizationId` na sessão.

```ts
@Controller('org/projects')
export class OrgProjectController {
  @MemberHasPermission({ permissions: { project: ['create', 'update'] } })
  @Post()
  create(@Session() s: UserSession) {
    return { orgId: s.session.activeOrganizationId };
  }

  @MemberHasPermission({ permissions: { project: ['delete'] } })
  @Post(':id/delete')
  remove() { /* ... */ }
}
```

Opção: `permissions` (obrigatória), com a mesma estrutura definida no access control da organização.

### 5.8 Qual usar?

| Situação | Decorator |
| --- | --- |
| Painel interno da tua equipa (superadmin) | `@Roles(['admin'])` |
| Ação de sistema com granularidade (ex.: gerir utilizadores) | `@UserHasPermission` |
| Dados de uma empresa/loja/tenant, sem role específica | `@RequireActiveOrg()` |
| Só dono ou gestor do tenant | `@OrgRoles(['owner','admin'])` |
| Ação fina dentro do tenant (criar venda, apagar projeto) | `@MemberHasPermission` |

Para o teu caso de plataformas modulares (negócios com equipa e funcionários), o padrão natural é: `@RequireActiveOrg()` na base, `@OrgRoles` para áreas de gestão e `@MemberHasPermission` para ações finas por módulo.

### 5.9 Armadilhas comuns

1. **Sem organização ativa, os decorators de organização falham.** O cliente precisa de definir a organização ativa (`organization.setActive`) depois do login, senão `activeOrganizationId` vem vazio.
2. **`@Roles` e `@OrgRoles` não se substituem.** Se uma rota deve aceitar admin do sistema **ou** admin da organização, tens de tratar isso explicitamente no teu código.
3. **Esconder botões no frontend não é segurança.** A verificação real é a do decorator no servidor.
4. **Não dependas do guard sem ele estar ativo.** Se usares `disableGlobalAuthGuard: true`, as rotas só ficam protegidas onde aplicares `AuthGuard`.
5. **Hexagonal:** usa estes decorators só na camada de entrada (controllers). Para os casos de uso passa apenas `userId`, `organizationId` e o que for preciso, nunca o `UserSession` inteiro.

## 6. Hooks (todos)

Existem **10 decorators de hooks** no total, em dois grupos. Todos são classes Nest normais, com injeção de dependências, registadas em `providers`.

| Grupo | Decorators |
| --- | --- |
| Hooks de rota | `@Hook()`, `@BeforeHook(path)`, `@AfterHook(path)` |
| Hooks de base de dados | `@DatabaseHook()`, `@BeforeCreate(model)`, `@AfterCreate(model)`, `@BeforeUpdate(model)`, `@AfterUpdate(model)`, `@BeforeDelete(model)`, `@AfterDelete(model)` |

### 6.1 Hooks de rota: `@Hook`, `@BeforeHook`, `@AfterHook`

Interceptam os endpoints do próprio Better Auth (`/sign-up/email`, `/sign-in/email`, `/sign-out`...). **Não criam endpoints novos.**

**Requisito:** pôr `hooks: {}` (objeto vazio) no `betterAuth(...)`. Podes continuar a ter os teus hooks nativos, o vazio é só o mínimo para ativar.

```ts
// auth.ts
export const auth = betterAuth({
  basePath: '/api/auth',
  hooks: {},
});
```

```ts
@Hook()
@Injectable()
export class SignUpHook {
  constructor(private readonly signUpService: SignUpService) {}

  @BeforeHook('/sign-up/email')
  async before(ctx: AuthHookContext) {
    // Ex.: impor domínio de email. Pode lançar APIError para bloquear.
    await this.signUpService.execute(ctx);
  }

  @AfterHook('/sign-up/email')
  async after(ctx: AuthHookContext) {
    // Ex.: criar o perfil no teu domínio, auditoria
  }
}
```

Registo:

```ts
@Module({
  imports: [AuthModule.forRoot({ auth })],
  providers: [SignUpHook, SignUpService],
})
export class AppModule {}
```

- `@Hook()` marca a classe como provider de hooks (usa junto com `@Injectable()`).
- `@BeforeHook(path)` corre antes do endpoint e pode lançar `APIError` para recusar.
- `@AfterHook(path)` corre depois da resposta ser construída (efeitos secundários).
- `ctx` é do tipo `AuthHookContext`, o contexto do endpoint do Better Auth.

### 6.2 Hooks de base de dados

Reagem ao ciclo de vida das operações nos modelos do Better Auth: `user`, `session`, `account` e `verification`.

**Requisito:** `databaseHooks: {}` no `betterAuth(...)`.

```ts
export const auth = betterAuth({
  databaseHooks: {},
});
```

```ts
@DatabaseHook()
@Injectable()
export class UserCreateHook {
  constructor(private readonly emailService: EmailService) {}

  @BeforeCreate('user')
  async beforeUserCreate(user) {
    return {
      data: {
        ...user,
        firstName: user.name.split(' ')[0],
        lastName: user.name.split(' ')[1],
      },
    };
  }

  @AfterCreate('user')
  async afterUserCreate(user) {
    await this.emailService.sendWelcomeEmail(user.email);
  }
}
```

| Decorator | Quando corre |
| --- | --- |
| `@BeforeCreate(model)` | Antes de criar um registo |
| `@AfterCreate(model)` | Depois de criar |
| `@BeforeUpdate(model)` | Antes de atualizar |
| `@AfterUpdate(model)` | Depois de atualizar |
| `@BeforeDelete(model)` | Antes de apagar |
| `@AfterDelete(model)` | Depois de apagar |

Regras de retorno:

- hooks `Before*` podem devolver `false` (aborta a operação) ou `{ data: ... }` (altera os dados antes de gravar)
- hooks `After*` são só para efeitos secundários

### 6.3 Qual escolher

- **Hook de rota** quando a lógica depende do fluxo (ex.: depois do `/sign-up/email`).
- **Hook de base de dados** quando queres reagir ao facto de o utilizador ser criado, **seja por que via for** (email, Google, admin...). Para criar perfil ou enviar boas-vindas, é normalmente o mais fiável.

## 7. Opções do módulo

```ts
AuthModule.forRoot({
  auth,
  disableTrustedOriginsCors: false,
  bodyParser: {
    json: { enabled: true },
    urlencoded: { enabled: true, extended: true },
    rawBody: false,
  },
  disableGlobalAuthGuard: false,
  disableControllers: false,
});
```

| Opção | Defeito | Descrição |
| --- | --- | --- |
| `disableTrustedOriginsCors` | `false` | Desliga o CORS automático baseado em `trustedOrigins` |
| `bodyParser` | json + urlencoded ativos | Configura os parsers que a lib volta a adicionar; `rawBody` ativa `req.rawBody` |
| `disableGlobalAuthGuard` | `false` | Não regista o `AuthGuard` global |
| `disableControllers` | `false` | Não regista as rotas `/api/auth/*` (só se fores tratá-las à mão) |
| `middleware` | indefinido | Middleware que envolve o handler do Better Auth, `(req, res, next)` |
| `disableBodyParser`, `enableRawBodyParser` | `false` | **Deprecadas**, usa `bodyParser` |

**CORS:** se definires `trustedOrigins` no `betterAuth(...)`, a lib aplica CORS às rotas de auth automaticamente.

**Fastify:** as rotas de auth passam por middleware, por isso o `@fastify/cors` global não as cobre sozinho. O fallback da lib só suporta `trustedOrigins` em array. Para `urlencoded` com `extended: true` precisas do pacote `qs`.

**Hono:** suportado. As opções `bodyParser` e `middleware` não se aplicam, e se o adaptador faz parse do corpo tens de excluir o `basePath` do Better Auth.

**Middleware personalizado** (por exemplo, para MikroORM):

```ts
AuthModule.forRoot({
  auth,
  middleware: (req, res, next) => {
    RequestContext.create(orm.em, next);
  },
});
```

## 8. Expo (app mobile a consumir o backend)

*Esta secção vem da documentação do Better Auth e não do README da lib Nest. Confirma os detalhes na versão que usas (1.7.x).*

### 8.1 Como funciona

Uma app nativa não tem cookies de browser. O plugin do Expo guarda o cookie de sessão no `expo-secure-store` e envia-o manualmente em cada pedido. Como a app fala **direto** com o backend (sem o rewrite do Next), não há problema de CORS, mas há dois pontos novos: o **scheme** da app tem de estar em `trustedOrigins`, e o redirect do login social volta por **deep link**.

### 8.2 Servidor (`auth.ts`)

```ts
import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';

export const auth = betterAuth({
  basePath: '/api/auth',
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [expo()],
  trustedOrigins: [
    'myapp://', // scheme da app
    'https://app.exemplo.com', // frontend web
    ...(process.env.NODE_ENV === 'development' ? ['exp://'] : []), // Expo Go
  ],
});
```

### 8.3 App Expo

```bash
npx expo install @better-auth/expo better-auth expo-secure-store expo-linking expo-web-browser expo-constants
```

Define o scheme no `app.json`:

```json
{ "expo": { "scheme": "myapp" } }
```

```ts
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL, // ex.: https://api.exemplo.com
  plugins: [
    expoClient({
      scheme: 'myapp',
      storagePrefix: 'myapp',
      storage: SecureStore,
    }),
  ],
});
```

Uso normal:

```ts
await authClient.signIn.email({ email, password });
const { data: session } = authClient.useSession();
await authClient.signOut();
```

### 8.4 Pedidos autenticados ao Nest

Para chamar os teus endpoints (que não passam pelo `authClient`), envia o cookie guardado e desliga o envio automático de cookies:

```ts
const cookie = authClient.getCookie();
const res = await fetch(`${API_URL}/v1/projects`, {
  headers: { Cookie: cookie },
  credentials: 'omit',
});
```

No Nest, o `AuthGuard` global trata esse cookie como qualquer outro. Alternativa: o plugin `bearer()` do Better Auth, que troca o cookie por um token `Authorization: Bearer`.

### 8.5 Login social (fluxo por redirect)

```ts
await authClient.signIn.social({
  provider: 'google',
  callbackURL: '/dashboard', // o plugin converte num deep link myapp://dashboard
});
```

O que acontece: abre o browser do sistema, o utilizador autentica-se, o Google devolve ao **teu backend** e o backend redireciona para o scheme da app.

Configuração no Google Cloud Console:

- **Authorized redirect URI:** o callback do **backend**, `https://api.exemplo.com/api/auth/callback/google`. Nunca o scheme da app.
- O mesmo padrão serve para GitHub, Discord, etc. (`/api/auth/callback/<provider>`).

### 8.6 Login social nativo (ID token)

Sem abrir o browser, usando o SDK nativo e enviando o token ao Better Auth. Precisa de **development build** (não funciona no Expo Go).

```ts
// Google (com @react-native-google-signin/google-signin)
await authClient.signIn.social({
  provider: 'google',
  idToken: { token: idToken },
});

// Apple (com expo-apple-authentication)
await authClient.signIn.social({
  provider: 'apple',
  idToken: { token: credential.identityToken },
});
```

No servidor, o provider precisa de aceitar os client IDs de iOS/Android como audiência do token. Confirma esse campo na documentação do provider da tua versão.

### 8.7 Armadilhas no Expo

1. **`baseURL` com `localhost` não funciona num telemóvel.** Usa o IP da máquina na rede local ou um túnel.
2. **Scheme em `trustedOrigins`:** se faltar, os pedidos são recusados (erro de origem inválida).
3. **Rotas nativas vs `/v1/auth`:** o `expoClient` só atua nos pedidos feitos pelo `authClient`. Se fizeres login nos controllers próprios (`/v1/auth/*`) com `fetch` simples, o cookie não é guardado. Para mobile, usa as rotas nativas do Better Auth.
4. **Expo Go vs build de produção:** o scheme em Expo Go é `exp://`, no build é o teu `myapp://`. Testa o login social num dev build.
5. **Organização ativa:** depois do login, define-a com `organization.setActive`, senão os decorators `@OrgRoles` e `@MemberHasPermission` falham.

## 9. Google One Tap

O One Tap é o popup do Google que oferece iniciar sessão com a conta já ativa no browser. **É só para web** (o teu Next.js). Em React Native não existe.

**Servidor:**

```ts
import { oneTap } from 'better-auth/plugins';

export const auth = betterAuth({
  socialProviders: { google: { clientId, clientSecret } },
  plugins: [oneTap()],
});
```

**Cliente (Next.js):**

```ts
import { createAuthClient } from 'better-auth/react';
import { oneTapClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [
    oneTapClient({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      autoSelect: false,
      cancelOnTapOutside: true,
      context: 'signin',
    }),
  ],
});
```

```ts
// num useEffect do layout ou da página de login
await authClient.oneTap({
  callbackURL: '/dashboard',
  onPromptNotification: (notification) => {
    // popup não apareceu: mostra o botão normal de Google
  },
});
```

Pontos importantes:

- O `clientId` tem de ser o **mesmo** do provider Google configurado no servidor.
- No Google Console, adiciona o domínio do Next em **Authorized JavaScript origins** (inclui `http://localhost:3000` em desenvolvimento).
- Com o rewrite `/api/auth/*` do Next, funciona sem alterações: o cookie fica first-party.
- O One Tap pode não aparecer (utilizador sem conta Google ativa, popup recusado várias vezes). Mantém sempre o botão tradicional como fallback.
- **Equivalente no Expo:** o login nativo com ID token (secção 8.6). Em Android o Google usa o Credential Manager, que é o análogo mobile do One Tap.

## 10. Arquitetura recomendada (hexagonal)

- **Domínio:** não importa nada de `better-auth` nem da lib Nest.
- **Entrada (controllers):** aqui vivem os decorators de rotas, roles e permissões e o `@Session()`. Convertem a sessão num tipo teu (`userId`, `organizationId`) antes de chamar os casos de uso.
- **Infraestrutura:** o `betterAuth(...)`, os hooks e o adapter do `AuthGateway` ficam aqui.
- **Hooks como ponte:** `@AfterCreate('user')` chama um caso de uso (por exemplo, criar perfil), sem o domínio saber de onde veio o evento.

### Checklist rápida

1. `bodyParser: false` no `main.ts`
2. `AuthModule.forRoot({ auth })` no módulo raiz
3. `trustedOrigins` com o URL do Next e o scheme do Expo
4. `hooks: {}` e/ou `databaseHooks: {}` se usares hooks
5. Plugins `admin` / `organization` com `ac` e `roles` definidos
6. Rewrite `/api/auth/*` no Next; `expoClient` na app mobile
7. Callback do Google apontado ao backend: `/api/auth/callback/google`

## 11. Sobre as fontes

As secções 1 a 7 e 10 são tradução e resumo do README de `@thallesp/nestjs-better-auth` que partilhaste. As secções 8 e 9 (Expo e One Tap) baseiam-se na documentação do próprio Better Auth, escrita de memória, por isso confirma os nomes exatos das opções na versão que tens instalada antes de copiar para produção.