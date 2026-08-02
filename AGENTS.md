# Goylo Backend Repository Instructions

These instructions apply to every change in this NestJS API repository. Read this file before fixing bugs, refactoring code, or adding features.

## Project structure

Use feature modules with API-oriented MVC separation:

```text
goylo-backend/
|-- prisma/                    # Prisma schema and database migrations
`-- src/
    |-- app.module.ts          # Root module registration only
    |-- main.ts                # Application bootstrap and global middleware
    |-- common/                # Genuinely cross-feature decorators, guards, DTOs, and types
    |-- database/              # Shared database module and DatabaseService
    `-- <feature>/
        |-- <feature>.module.ts
        |-- <feature>.controller.ts
        |-- <feature>.service.ts
        `-- dto/               # Feature-specific request and response DTOs
```

## Architecture rules

- Every API feature belongs in its own folder and Nest module.
- Controllers define routes, accept validated request data, and delegate work. Controllers must not contain business rules or direct Prisma queries.
- Services contain business rules and database operations. Nest services are the project equivalent of the model/business layer.
- Modules wire together the controllers, services, and imports for one feature.
- Put feature-specific DTOs under that feature. Keep a DTO, decorator, guard, or type in `common` only when multiple features genuinely share it.
- Access Prisma through `DatabaseService`. Do not instantiate `PrismaClient` elsewhere.
- Keep authentication and authorization explicit through the existing decorators, guards, and ownership checks.
- Validate all externally supplied data through DTO decorators and the global validation pipe.
- Register every new feature module in `app.module.ts`.
- When changing the Prisma schema, create the appropriate migration and regenerate the Prisma client.
- Keep files focused. Split files that handle multiple unrelated responsibilities.
- Use descriptive filenames. Do not recreate catch-all files such as `services.ts`, `controllers.ts`, or `dto.ts` for unrelated features.

## Code quality

- Preserve strict TypeScript typing. Do not introduce `any` to bypass type errors.
- Follow the installed TypeScript ESLint and Prettier rules. Do not disable rules merely to make checks pass.
- Reuse existing code before creating duplicates.
- Save source files as UTF-8.
- Check user-facing API messages for mojibake or replacement characters.
- Do not edit generated folders such as `node_modules` or `dist`.
- Do not modify an existing migration after it may have been applied; create a new migration instead.

## Required verification

Before completing any change, run from the repository root:

```powershell
npm run lint
npm run build
npm test
```

Lint and build must finish with zero errors and zero warnings. Run relevant tests for every behavior change and add tests when introducing new behavior.

If the Prisma schema changed, also run:

```powershell
npm run prisma:generate
```

## Definition of done

A change is complete only when:

1. New code follows the feature-module structure above.
2. Controllers, services, DTOs, and database responsibilities remain separated.
3. Existing code has not been moved into a less specific catch-all file.
4. Validation, authentication, and authorization remain explicit.
5. Linting, build, and relevant tests pass.
6. Prisma migrations, documentation, and environment examples are updated when required.
