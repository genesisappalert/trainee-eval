# Genesis Group — Management Trainee Programme (MTP) Appraisal Platform

A centralized, enterprise-grade performance appraisal and talent development platform designed for **Genesis Group**. The system manages the complete evaluation cycle for the Management Trainee Programme (MTP), orchestrating trainee self-assessments, supervisor evaluations, digital signatures, and HR administrative oversight.

---

## 🌟 Key Features

### 1. Management Trainee Portal (`/a/[slug]`)
- **Dual Form Modes**:
  - **Guided Step-by-Step Wizard**: Modern multi-step flow with progress tracking, rating scales, and character counters.
  - **Official Paper Form (Pixel-Perfect)**: Recreates the exact Genesis Group Word document layout with real-time live synchronization between both modes.
- **Autosave & Resume**: Automatic debounced draft saving with unique private resume tokens (`#token`), allowing trainees to pause and resume work without loss of data.
- **Digital Signatures**: Canvas-based touch/mouse signature pad with real-time SVG/PNG capture and timestamping.
- **HR Confidential Questions**: Questions flagged as confidential are strictly hidden from supervisors and only visible to HR Talent Management.

### 2. Supervisor Evaluation Portal (`/supervisor`)
- **Quick Access Code Authentication**: Supervisors sign in instantly using their designated access codes (e.g., `SUP-1010` / `SUP-XXXXXX`).
- **Interactive Queue Management**:
  - Filter by `All`, `Action Required`, `In Progress Drafts`, and `Completed`.
  - Live search across trainee names, staff IDs, and departments.
  - Urgency indicators tracking days outstanding since trainee submission.
- **Side-by-Side Split Workspace**: View trainee self-assessment responses on the left while scoring the 7 core competencies on the right.
- **Competency Ratings**:
  1. Job Knowledge & Technical Competence
  2. Quality & Accuracy of Work
  3. Work Output & Productivity
  4. Dependability & Attendance
  5. Initiative & Problem Solving
  6. Interpersonal Relations & Teamwork
  7. Communication Skills
- **Reassignment Workflow**: Supervisors can flag incorrect allocations (`Not Mine`) with audit reasons.

### 3. HR Admin & Superadmin Dashboard (`/admin`)
- **Executive Analytics**: Real-time KPI stat cards inspired by Genesis Feedback (`Active Cycles`, `Supervisors`, `Completed Records`, `Flagged Issues`).
- **Superadmin & Role Governance (`/admin/admins`)**: Superadmins can provision and manage other Superadmins and HR Administrators with full RBAC, dual-role privileges, password resets, and account lifecycle controls.
- **Cycle Management**: Create and launch appraisal cycles, configure submission deadlines, and monitor real-time completion progress bars.
- **Supervisor & Trainee Management**: Map supervisors to trainees, import cohorts, and generate unique access keys.
- **Enterprise Exports**:
  - **Excel (`.xlsx`)**: Full tabular exports containing all section responses, ratings, and summary stats.
  - **Word / DOCX / Print**: Print-ready, pixel-perfect official documents with embedded trainee and supervisor signatures.
- **Audit Trails**: Full system activity logging tracking who did what, when, and from where.

### 4. Design System & Theme Engine
- **Genesis Feedback Design Language**: Polished aesthetics matching Genesis Group's internal design system.
- **Typography**: Google Fonts [Sora](https://fonts.google.com/specimen/Sora) for crisp modern UI and [DM Mono](https://fonts.google.com/specimen/DM+Mono) for metrics, timestamps, and codes.
- **Color Palette**: Electric Genesis Crimson (`#FF0C34`) with hover states, soft tints, and glowing focus rings.
- **Light & Dark Mode**: Built-in `ThemeProvider` with seamless one-click `<ThemeToggle />` switch persisted in `localStorage`.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16 (Turbopack)](https://nextjs.org) with App Router
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Database**: [MongoDB](https://www.mongodb.com) with [Mongoose 9](https://mongoosejs.com)
- **Authentication**: [NextAuth.js v5 (Auth.js Beta)](https://authjs.dev)
- **Document Processing**: `docxtemplater`, `pizzip`, and `xlsx` (SheetJS)
- **Signature Capture**: `signature_pad`
- **Styling**: Vanilla CSS Design Tokens with CSS Custom Properties and light/dark mode variables

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.18 or higher (v20+ recommended)
- **npm**: v9+ or **pnpm**
- **MongoDB**: A running MongoDB instance locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas connection string.

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-org/mtp-appraisal.git
cd mtp-appraisal
npm install
```

### 2. Configure Environment Variables

Copy the example environment template:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Database
MONGODB_URI=mongodb://127.0.0.1:27017/mtp_appraisal

# Authentication (NextAuth.js v5)
AUTH_SECRET=your_nextauth_secret_key_minimum_32_characters
NEXTAUTH_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

### 3. Seed Initial Demo Data

Run the database seed script to populate sample appraisal cycles, supervisors, and trainees:

```bash
npx tsx lib/seed.ts
```

*(Alternatively, you can trigger `/api/seed` in your browser during local development).*

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Default Seed Credentials

After running the database seed script:

| Role | Login URL | Identifier | Password / Code |
| :--- | :--- | :--- | :--- |
| **HR Super Admin** | `/login` (HR Admin Tab) | `GEN-ADMIN-001` | `GenesisAdmin2026!` |
| **Supervisor 1** | `/login` (Supervisor Code Tab) | `SUP-1010` | *(Access Code)* |
| **Supervisor 2** | `/login` (Supervisor Code Tab) | `SUP-2020` | *(Access Code)* |
| **Trainee Portal** | `/a/mtp-2026-q1` | — | *(Direct Link / No Login)* |

---

## 📂 Project Structure

```text
mtp-appraisal/
├── app/
│   ├── a/[slug]/                # Trainee appraisal filling page
│   ├── admin/                   # HR Admin portal (cycles, roster, exports, audit)
│   │   ├── admins/              # Admins & Roles governance (superadmin provisioner)
│   │   ├── cycles/              # Appraisal cycle manager & progress tracker
│   │   ├── exports/             # Excel & DOCX report export center
│   │   ├── supervisors/         # Supervisor roster & key generator
│   │   ├── audit/               # Security & activity logs
│   │   └── page.tsx             # Admin executive KPI dashboard
│   ├── api/                     # Backend API routes
│   │   ├── admins/              # Superadmin & HR Admin management endpoints
│   │   ├── auth/                # NextAuth session handlers
│   │   ├── cycles/              # Cycle CRUD & tracking endpoints
│   │   ├── supervisor/          # Supervisor assessment & queue endpoints
│   │   ├── trainee/             # Trainee autosave & submission endpoints
│   │   └── seed/                # Demo database seeder
│   ├── login/                   # Dual-tab unified login screen
│   ├── supervisor/              # Supervisor evaluation portal & assess workspace
│   ├── globals.css              # Genesis design system & CSS variables
│   └── layout.tsx               # Root layout with ThemeProvider & branding
├── components/
│   ├── OfficialFormDocument.tsx # Pixel-perfect official Word/Paper print template
│   └── ThemeToggle.tsx          # Light/Dark mode animated theme switch
├── lib/
│   ├── auth.ts                  # NextAuth credentials authentication config
│   ├── db.ts                    # MongoDB Mongoose connection manager
│   ├── theme.tsx                # Client theme context & state persistence
│   ├── forms/definitions.ts     # Canonical appraisal questions & rating scales
│   ├── models/                  # Mongoose models (User, Cycle, Appraisal, Audit)
│   └── seed.ts                  # Database seeding CLI script
├── public/
│   └── genesis-logo.png         # Official Genesis Group emblem
├── .env.example                 # Example environment variables for deployment
├── .gitignore                   # Git ignore rules
├── package.json                 # Project dependencies & scripts
└── tsconfig.json                # TypeScript compiler configuration
```

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server with hot-reload |
| `npm run build` | Compiles an optimized production build with Turbopack |
| `npm run start` | Starts the compiled production server |
| `npm run lint` | Runs ESLint checks across code files |
| `npx tsc --noEmit` | Runs strict TypeScript type-checking across the repository |

---

## 🛡️ License

Proprietary — Built exclusively for **Genesis Group**. Unauthorized distribution or copying is strictly prohibited.
