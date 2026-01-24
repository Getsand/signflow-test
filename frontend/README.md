# SignFlo Frontend

A modern, responsive React application for document signing, built with Vite, TypeScript, and Tailwind CSS.

---

## 🎨 Design System

The design system is inspired by professional document signing platforms (DocuSign, HelloSign) with a focus on **trust, reliability, and ease of use**.

### Color Palette

#### Primary Colors (Blue/Purple)
The primary color scheme uses a professional blue-purple gradient that conveys **trust, security, and professionalism**.

- **Primary 500** (`#6366f1`) - Main brand color used for CTAs, links, and focus states
- **Primary 600** (`#4f46e5`) - Hover states for primary buttons
- **Primary 700** (`#4338ca`) - Active states
- **Primary 50-100** - Light backgrounds for subtle highlights

**Usage:**
- Primary buttons and CTAs
- Links and interactive elements
- Focus rings and active states
- Brand elements (logo, headers)

#### Secondary Colors (Teal)
Secondary colors provide visual variety and are used for **secondary actions and accents**.

- **Secondary 500** (`#14b8a6`) - Secondary brand color
- **Secondary 600** (`#0d9488`) - Hover states

**Usage:**
- Secondary buttons
- Alternative CTAs
- Decorative accents

#### Neutral Colors (Grays)
A comprehensive gray scale for text, borders, and backgrounds.

- **Neutral 900** - Primary text color
- **Neutral 700** - Secondary text
- **Neutral 600** - Helper text
- **Neutral 400-500** - Disabled states
- **Neutral 200-300** - Borders
- **Neutral 50-100** - Backgrounds

**Usage:**
- All text content
- Borders and dividers
- Card backgrounds
- Disabled states

#### Status Colors
Clear, accessible colors for different states.

- **Success** (`#22c55e`) - Completed, signed documents
- **Warning** (`#f59e0b`) - Pending actions
- **Error** (`#ef4444`) - Errors, failed states

---

### Typography

#### Font Family
**Inter** - A modern, highly readable sans-serif font designed for UI.

```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;
```

**Why Inter?**
- Excellent readability at all sizes
- Professional appearance
- Wide language support
- Optimized for screens

#### Font Sizes
```
xs:   0.75rem (12px) - Small labels, helper text
sm:   0.875rem (14px) - Body text, form labels
base: 1rem (16px) - Default body text
lg:   1.125rem (18px) - Emphasized text
xl:   1.25rem (20px) - Card titles
2xl:  1.5rem (24px) - Section headers
3xl:  1.875rem (30px) - Page titles
4xl:  2.25rem (36px) - Hero headlines
5xl:  3rem (48px) - Large displays
```

#### Line Heights
All font sizes include optimized line heights for readability and visual balance.

---

### Spacing System

Consistent spacing using Tailwind's default scale (4px base unit).

**Common patterns:**
- **Component padding:** `p-4` (16px), `p-6` (24px), `p-8` (32px)
- **Section spacing:** `space-y-6` (24px), `space-y-8` (32px)
- **Card gaps:** `gap-4` (16px), `gap-6` (24px)

---

### Components

#### Button Styles

**Variants:**
- **Primary** - High-emphasis actions (submit, upload, sign)
- **Secondary** - Medium-emphasis actions
- **Outline** - Low-emphasis actions, alternative choices
- **Ghost** - Minimal styling, navigation items
- **Danger** - Destructive actions (delete, remove)

**Sizes:**
- **sm** - Compact buttons for tight spaces
- **md** - Default size for most use cases
- **lg** - Prominent CTAs and primary actions

**Features:**
- Built-in loading states with spinner
- Icon support (left and right)
- Full-width option
- Consistent hover/active states
- Proper disabled states

#### Input Fields

**Features:**
- Integrated label and error messaging
- Icon support (left and right)
- Helper text below input
- Accessible with proper ARIA attributes
- Focus states with visible ring
- Error states with red styling

**Types:**
All standard HTML input types supported: text, email, password, number, etc.

#### Cards

Flexible container component for grouping content.

**Features:**
- Consistent padding options (sm, md, lg, none)
- Optional hover effects
- Subcomponents: CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- Subtle shadows for depth
- Rounded corners

#### Navbar

Sticky navigation bar with:
- Logo and brand name
- Navigation links (Dashboard, Upload, Documents)
- User profile dropdown
- Responsive mobile menu
- Logout functionality

#### Footer

Application footer with:
- Brand information
- Product links
- Support links
- Copyright notice

---

### Layouts

#### AuthLayout
Split-screen design for authentication pages:
- **Left side (desktop only):** Brand messaging, feature highlights, gradient background
- **Right side:** Form content (login, signup)
- Fully responsive (mobile shows only the form with minimal header)

**Design decisions:**
- Large gradient background conveys trust and professionalism
- Feature highlights educate users while they authenticate
- Clean, minimal form area reduces cognitive load

#### MainLayout
Standard application layout:
- Sticky navbar at top
- Main content area with max-width container
- Footer at bottom
- Consistent padding and spacing

---

### Pages

#### Login (`/login`)
- Email and password inputs
- Loading states
- Error handling
- Link to signup
- TODO: Backend integration for JWT authentication

#### Dashboard (`/dashboard`)
- Stats overview (total documents, pending, completed, locked)
- Recent documents list
- Quick actions (upload, view all)
- TODO: Fetch real data from API

#### Upload (`/upload`)
- Drag-and-drop file upload
- File size and type validation
- Upload progress indicator
- TODO: Implement presigned URL flow with backend

#### Document Detail (`/documents/:id`)
- Document preview (PDF viewer placeholder)
- Signature fields list
- Field management (add, delete)
- Signing functionality
- TODO: Integrate PDF.js, connect to backend API

---

## 🛠️ Technology Stack

- **Vite** - Fast build tool and dev server
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **React Router v6** - Client-side routing

---

## 📦 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── index.ts
│   │   └── layout/          # Layout components
│   │       ├── AuthLayout.tsx
│   │       ├── MainLayout.tsx
│   │       └── index.ts
│   ├── pages/               # Page components
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   └── index.ts
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   └── index.ts
│   │   ├── upload/
│   │   │   ├── Upload.tsx
│   │   │   └── index.ts
│   │   └── documents/
│   │       ├── DocumentDetail.tsx
│   │       └── index.ts
│   ├── types/               # TypeScript type definitions
│   ├── lib/                 # Utility functions
│   ├── App.tsx              # Main app with routing
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles + Tailwind
├── tailwind.config.js       # Tailwind configuration
├── postcss.config.js        # PostCSS configuration
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
└── package.json
```

---

## 🚀 Getting Started

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## 🔌 Backend Integration (TODO)

The frontend is ready for backend integration. Here's what needs to be implemented:

### 1. Authentication
- [ ] Create `AuthContext` for managing authentication state
- [ ] Store JWT token in localStorage or httpOnly cookie
- [ ] Implement login API call to `/api/v1/auth/login`
- [ ] Implement logout functionality (clear token)
- [ ] Create `ProtectedRoute` component to guard authenticated routes
- [ ] Add token refresh logic

### 2. File Upload Flow
- [ ] Request presigned URL from `/api/v1/files/presign`
- [ ] Upload file directly to MinIO using presigned URL
- [ ] Finalize upload with `/api/v1/files/{file_id}/finalize`
- [ ] Handle upload errors and retries

### 3. Document Management
- [ ] Fetch documents list from `/api/v1/files`
- [ ] Fetch single document details from `/api/v1/files/{file_id}`
- [ ] Implement document deletion

### 4. Signature Fields
- [ ] Create signature fields via `/api/v1/signatures/fields`
- [ ] List signature fields for a document
- [ ] Delete signature fields (only if PENDING)
- [ ] Sign a field via `/api/v1/signatures/fields/{field_id}/sign`

### 5. PDF Viewing
- [ ] Integrate PDF.js for in-browser PDF rendering
- [ ] Display signature field overlays on PDF pages
- [ ] Allow dragging signature fields to position them

---

## 🎯 Design Principles

1. **Trust & Security** - Professional color scheme and clear visual hierarchy
2. **Simplicity** - Clean, uncluttered interfaces
3. **Accessibility** - Proper focus states, ARIA labels, keyboard navigation
4. **Responsiveness** - Mobile-first approach, works on all screen sizes
5. **Performance** - Optimized animations, lazy loading where appropriate
6. **Consistency** - Reusable components, consistent spacing and typography

---

## 📝 Style Decisions Summary

| Element | Decision | Reason |
|---------|----------|--------|
| **Primary Color** | Blue/Purple (`#6366f1`) | Conveys trust and professionalism |
| **Font** | Inter | Modern, readable, optimized for UI |
| **Shadows** | Subtle, layered | Adds depth without overwhelming |
| **Borders** | Rounded (`0.5rem` default) | Friendly, modern appearance |
| **Spacing** | 4px base unit | Consistent, predictable layout |
| **Animations** | Smooth, 200ms | Responsive feel without delay |
| **Button Styles** | Multiple variants | Clear hierarchy of actions |
| **Form Inputs** | Large, with icons | Easy to use, accessible |

---

## 🤝 Contributing

When adding new components:
1. Follow the existing component structure
2. Use TypeScript for type safety
3. Export components from barrel files (`index.ts`)
4. Add proper JSDoc comments
5. Ensure accessibility (ARIA labels, keyboard navigation)
6. Keep components small and focused
7. Use Tailwind classes consistently

---

## 📄 License

This project is part of the SignFlo document signing platform.

---

**Built with ❤️ for secure, fast document signing**


