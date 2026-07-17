# Syasyah Samaj — Architecture

## Tech Stack

| Layer        | Technology                                      |
| ------------ | ----------------------------------------------- |
| Framework    | Next.js 15 (App Router)                         |
| CMS          | Payload CMS 3.75 (headless)                     |
| Database     | PostgreSQL (`@payloadcms/db-postgres`)           |
| Cache/Queue  | Redis (ioredis)                                 |
| Auth         | Better Auth + `payload-better-auth`             |
| Email        | Resend (`@payloadcms/email-resend`)              |
| i18n         | next-international (en, ne, new)                |
| UI           | Tailwind CSS, Radix UI, shadcn/ui, Framer Motion |
| Maps         | Leaflet + react-leaflet                         |
| Search       | `@payloadcms/plugin-search`                     |
| Storage      | Payload Cloud                                   |
| Language     | TypeScript                                      |

---

## High-Level Architecture

```mermaid
graph TB
    subgraph Client
        Browser[Browser]
    end

    subgraph "Next.js 15 (App Router)"
        direction TB
        MW[Middleware<br/>i18n + Tenant Routing]
        Pages[Pages / Layouts]
        API[API Routes<br/>REST + GraphQL]
        Admin[Payload Admin Panel]
    end

    subgraph "Payload CMS 3.75"
        direction TB
        Config[Payload Config]
        Collections[15 Collections]
        Globals[Header / Footer]
        Plugins[10+ Plugins]
        Auth[Better Auth]
        RBAC[Access Control]
    end

    subgraph "Infrastructure"
        PG[(PostgreSQL)]
        RD[(Redis)]
        RS[Resend Email]
        PC[Payload Cloud Storage]
    end

    Browser --> MW
    MW --> Pages
    MW --> Admin
    MW --> API
    Pages --> Collections
    Admin --> Config
    Config --> Collections
    Config --> Globals
    Config --> Plugins
    Collections --> PG
    Collections --> RD
    Collections --> RS
    Collections --> PC
```

---

## Layers & Dependency Flow

```mermaid
graph LR
    subgraph Entry
        app[app/ — Routes & Pages]
        collections[collections/ — CMS Config]
        heros[heros/ — Hero Sections]
        Header[Header/ — Global Header]
        Footer[Footer/ — Global Footer]
    end

    subgraph Internal
        components[components/ — UI Components]
        blocks[blocks/ — Page Builder Blocks]
    end

    subgraph Core
        utilities[utilities/ — Helpers]
        access[access/ — RBAC]
        providers[providers/ — React Context]
        fields[fields/ — Custom CMS Fields]
        hooks[hooks/ — Payload Hooks]
        endpoints[endpoints/ — Custom Endpoints]
    end

    subgraph Infrastructure
        lib[lib/ — Auth, Email]
        plugins[plugins/ — Plugin Config]
        search[search/ — Search Config]
        migrations[migrations/ — DB Migrations]
    end

    app --> components
    app --> blocks
    app --> providers
    app --> utilities

    collections --> access
    collections --> utilities

    components --> utilities
    components --> blocks

    blocks --> components
    blocks --> utilities

    heros --> components
    Header --> providers
    Footer --> utilities

    providers --> utilities
    plugins --> lib
    plugins --> access
    plugins --> utilities
```

---

## Collections (Data Model)

```mermaid
classDiagram
    class User {
        +id
        +name
        +email
        +role
        +tenants
        +tenantId
    }
    class Tenant {
        +id
        +slug
        +name
        +domains
    }
    class Post {
        +id
        +title
        +slug
        +content
        +tenantId
        +locale
    }
    class Page {
        +id
        +title
        +slug
        +content
        +tenantId
        +locale
    }
    class Event {
        +id
        +title
        +date
        +location
        +tenantId
    }
    class Member {
        +id
        +name
        +tenantId
    }
    class Order {
        +id
        +items
        +total
        +userId
    }
    class Ticket {
        +id
        +eventId
        +userId
        +type
    }
    class ChatRoom {
        +id
        +name
        +tenantId
    }
    class Message {
        +id
        +roomId
        +senderId
        +content
        +timestamp
    }
    class Notification {
        +id
        +userId
        +type
        +read
    }
    class Favorite {
        +id
        +userId
        +postId
    }
    class Archive {
        +id
        +tenantId
        +category
    }
    class Category {
        +id
        +title
        +slug
        +parent
    }
    class Media {
        +id
        +filename
        +url
        +alt
    }

    User --> Tenant : belongs to
    Post --> Tenant : scoped
    Post --> Category : categorized
    Post --> User : author
    Event --> Tenant : scoped
    Member --> Tenant : scoped
    Order --> User : owner
    Ticket --> Event : references
    ChatRoom --> Tenant : scoped
    Message --> ChatRoom : belongs to
    Message --> User : sender
    Notification --> User : target
    Favorite --> User : owner
    Favorite --> Post : references
    Archive --> Tenant : scoped
```

---

## Plugin Ecosystem

```mermaid
graph TB
    PC[Payload Config] --> Redirects[redirectsPlugin]
    PC --> NestedDocs[nestedDocsPlugin]
    PC --> SEO[seoPlugin]
    PC --> FormBuilder[formBuilderPlugin]
    PC --> Search[searchPlugin]
    PC --> PayloadCloud[payloadCloudPlugin]
    PC --> BetterAuth[betterAuthCollections]
    PC --> CreateBetterAuth[createBetterAuthPlugin]
    PC --> MultiTenant[multiTenantPlugin]

    MultiTenant --> Posts
    MultiTenant --> Users
    MultiTenant --> Media
    MultiTenant --> Events
    MultiTenant --> Members
    MultiTenant --> Archives
    MultiTenant --> Messages
    MultiTenant --> ChatRooms
```

---

## Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant U as User
    participant MW as Middleware
    participant BA as Better Auth
    participant PC as Payload CMS
    participant DB as PostgreSQL
    participant RS as Resend

    U->>MW: Request (subdomain / login)
    MW->>MW: Extract tenant from subdomain
    MW->>U: Set x-current-tenant header + cookie

    U->>BA: POST /api/auth/login
    BA->>DB: Verify credentials
    BA->>U: Return session token

    U->>PC: Request admin / API (with token)
    PC->>BA: Validate session
    BA->>PC: User context

    PC->>PC: Check access control
    PC->>DB: Query scoped by tenant
    PC->>U: Return data

    alt Forgot / Reset Password
        U->>BA: Request reset
        BA->>RS: Send email
        RS->>U: Reset link
        U->>BA: Set new password
    end
```

---

## Routing & Multi-Tenant Resolution

```mermaid
graph TD
    Request[Incoming Request] --> Host{Check Host}
    Host -->|subdomain.afnoevents.com| Subdomain[Extract Subdomain]
    Host -->|syasyahsamaj.com| MainDomain[No Subdomain]
    Host -->|localhost:3000| LocalDev

    Subdomain --> SetTenant[Set x-current-tenant header<br/>Set current-tenant cookie]
    MainDomain --> I18n[i18n Middleware]
    LocalDev --> I18n

    SetTenant --> Pages[Render Tenant Pages]
    I18n --> LocaleRoute{Locale?}
    LocaleRoute -->|/en| English[English Pages]
    LocaleRoute -->|/ne| Nepali[Nepali Pages]
    LocaleRoute -->|/new| Newari[Newari Pages]

    Pages --> Payload[Payload CMS - Scoped by Tenant]
    English --> Payload
```

---

## Directory Structure

```
src/
├── access/          # RBAC definitions (admin, editor, anyone, etc.)
├── app/             # Next.js App Router
│   ├── (payload)/   # Payload admin UI
│   ├── [locale]/    # Internationalized frontend routes
│   └── api/         # Custom API endpoints
├── blocks/          # Page builder blocks (Content, Media, CTA, etc.)
├── collections/     # Payload CMS collections (15 total)
├── components/      # Reusable React components & shadcn/ui
├── context/         # React context (empty, available for future use)
├── endpoints/       # Custom Payload endpoints
├── fields/          # Custom Payload field types (slug, link, etc.)
├── Footer/          # Global Footer (Payload global config)
├── Header/          # Global Header (Payload global config)
├── heros/           # Hero section variants
├── hooks/           # Payload lifecycle hooks
├── lib/             # Auth, Email, external integrations
├── locales/         # i18n config (en, ne, new)
├── migrations/      # PostgreSQL migrations
├── plugins/         # Plugin configuration
├── providers/       # React context providers (Theme, HeaderTheme)
├── search/          # Search plugin config
└── utilities/       # Shared helpers (cn, merge, format, etc.)
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CMS | Payload CMS 3.x | Headless, type-safe, self-hosted, great DX |
| Multi-tenancy | Plugin-based (shared DB, tenant field) | Isolates data by tenant without per-tenant DBs |
| Auth | Better Auth (external) | Decouples auth from CMS, supports OAuth/2FA |
| Database | PostgreSQL | Reliable, ACID, good with Payload |
| Cache | Redis | Session cache, rate limiting, pub/sub for chat |
| i18n | next-international | Lightweight, type-safe, good Next.js App Router support |
| UI Framework | Tailwind + Radix + shadcn/ui | Accessible, customizable, modern |
| Maps | Leaflet (self-hosted tiles) | Free, privacy-friendly, no API key required |
| File Storage | Payload Cloud | Integrated, simple, no extra setup |
