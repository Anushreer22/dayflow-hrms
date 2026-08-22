# Dayflow HRMS

A modern, secure, and user-friendly **Human Resource Management System** built for hackathons and real-world use. Dayflow streamlines attendance tracking, leave management, payroll calculation, and employee administration in one clean interface.

![React](https://img.shields.io/badge/React-18-blue?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-purple?logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3fcf8e?logo=supabase)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### 🔐 Authentication & Roles
- Admin-driven employee creation (no self-registration)
- Unique Login ID auto-generation (e.g. `OIJODO20220001`)
- Secure email/password sign-in with forced password change on first login
- Forgot password, reset password, and resend verification email flows
- Silent session refresh and expiry handling
- Role-based access: **Admin** and **Employee**

### 🕒 Attendance Management
- Check-in / Check-out with duplicate prevention
- Automatic work hours and extra hours calculation (8-hour standard day)
- Monthly attendance view for employees with date navigation
- Admin dashboard with today's attendance for all employees and monthly summary counts

### 🏖️ Leave Management
- Paid / Sick / Unpaid leave types
- Leave balance cards
- Apply for leave with date validation, overlap detection, and attachment (required for Sick Leave)
- Admin approval / rejection with reviewer comments
- Live status updates on the employee side

### 💰 Salary & Payroll
Auto-calculation of salary components based on monthly wage:
- Basic = 50% of Wage
- HRA = 50% of Basic
- Standard Allowance = ₹4,167 (fixed)
- Performance Bonus = 8.33% of Basic
- LTA = 8.33% of Basic
- Fixed Allowance = remainder
- PF Employee / Employer = 12% of Basic each
- Professional Tax = ₹200 (fixed)

Admin salary edit with before/after preview and automatic recalculation. Employee read-only payslip view.

### 👤 Profile Management
- View profile with tabs: My Profile, Resume, Private Info, Skills, About
- Salary Info tab (admin-only)
- Role-based editing: employees can edit phone/address/photo; admins can edit all fields
- Profile picture upload with instant preview

### 📊 Dashboards
- **Employee Dashboard** — greeting, quick check-in, KPI cards, weekly attendance chart, recent activity, quick actions
- **Admin Dashboard** — employee status cards (🟢 present / ✈️ leave / 🟡 absent), employee list, attendance/leave summary, pending approvals

### 🔔 Notifications
- Real notification list with unread count badge
- Mark as read, persisted to backend
- Friendly empty state when there are none

### 📱 Polish & UX
- Modern sidebar layout with icons, collapses on smaller screens
- Responsive at 320px, 375px, 768px, 1024px, and 1440px
- Loading skeletons, empty states, and non-technical error messages
- Accessible: keyboard navigation, visible focus states, aria-live announcements

### 🔒 Security
- Row Level Security (RLS) on every table
- Employees can only read/write their own data; admins have full access
- Database triggers enforce profile edit restrictions and salary recalculation
- Every privileged API action is verified server-side, not just hidden in the UI

---

## 🛠️ Tech Stack

| Layer      | Technology                                          |
|------------|------------------------------------------------------|
| Frontend   | React, Vite, Tailwind CSS, shadcn/ui, lucide-react   |
| Backend    | Supabase (PostgreSQL, Auth, Storage, RLS)            |
| API        | Supabase Client, Express (optional)                  |
| Deployment | Vercel (frontend), Supabase (backend)                |

---

## 📁 Project Structure

```
dayflow/
├── src/
│   ├── components/                  # UI components (shadcn)
│   ├── lib/                         # Supabase client, status utilities
│   ├── pages/                       # Page components
│   ├── App.tsx                      # Main application
│   └── main.tsx                     # Entry point
├── supabase/
│   ├── schema.sql                   # Core tables
│   ├── rls.sql                      # Row Level Security policies
│   ├── login_id.sql                 # Login ID generation function
│   ├── profile_update_trigger.sql   # Profile update restrictions
│   ├── salary_calculation.sql       # Salary auto-calculation
│   ├── leave_storage.sql            # Leave attachment bucket/policies
│   └── seed.sql                     # Demo seed data
├── server/
│   └── index.mjs                    # Optional Express admin API
├── .env.example                     # Environment variables template
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Supabase account and project

### 1. Clone the repository
```bash
git clone https://github.com/Anushreer22/dayflow-hrms.git
cd dayflow-hrms
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file from the example:
```bash
cp .env.example .env
```
Fill in your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Set up the database
Run the SQL files in this order in your Supabase SQL Editor:
1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/login_id.sql`
4. `supabase/profile_update_trigger.sql`
5. `supabase/salary_calculation.sql`
6. `supabase/leave_storage.sql`
7. `supabase/seed.sql` (optional — demo data)

### 5. Start the development server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Demo Credentials

| Role     | Email                    | Password         |
|----------|---------------------------|-------------------|
| Admin    | admin@dayflow.com         | Admin@12345       |
| Employee | john.doe@example.com      | NewPassword123!   |

> If these accounts don't exist yet, create them in Supabase Authentication and insert the matching rows in `public.users` and `public.profiles`.

---

## 🌐 Deployment

### Frontend (Vercel)
1. Push your code to GitHub.
2. Import the repository in Vercel.
3. Set environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Build command: `npm run build` — output directory: `dist`.
5. Deploy.

### Backend (Supabase)
1. Use the same Supabase project for production.
2. Update **Authentication → URL Configuration** with your Vercel URL.
3. Run all SQL migrations in production.
4. Create storage buckets and policies.

---

## 📸 Screenshots

_Add screenshots of login, dashboard, attendance, leave, salary, and profile screens here._

---

## 🤝 Contributing

Contributions are welcome — please open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Lucide](https://lucide.dev)
