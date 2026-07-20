# PROJECT_SPEC.md

# Persona AI
### Intelligent Transaction Security & Behavioral Fraud Detection Platform

---

# Project Vision

Build a professional fintech web application that demonstrates how AI can make digital banking significantly more secure by analyzing user behavior before approving sensitive transactions.

The application should look and feel like a real banking product rather than a hackathon prototype.

Primary goals:

- Professional UI
- Strong security features
- Intelligent risk analysis
- Modern architecture
- Clean scalable code

---

# Target Users

- Individual banking customers
- Banks
- Financial institutions

---

# Core Problem

Current banking systems mainly verify identity.

They rarely verify whether the person performing the transaction is behaving normally.

Our platform creates a behavioral baseline for every user and continuously evaluates transaction risk.

---

# Core Features

## Authentication

- Login
- Register
- Demo account
- Protected dashboard

---

## Dashboard

Display:

- Total Balance
- Monthly Spending
- Savings
- Risk Score
- Recent Transactions
- AI Alerts
- Spending Categories

---

## Transaction Analysis

Allow users to:

- Import CSV bank statements
- Import PDF statements
- View categorized transactions
- Search transactions
- Filter by date
- Filter by category

---

## AI Behavioral Profile

Maintain:

- Typical spending amount
- Spending frequency
- Preferred merchants
- Active hours
- Location history
- Device history

Generate a personal behavioral baseline.

---

## Risk Engine

Every transaction receives a risk score.

Example factors:

- Unusual amount
- New merchant
- New device
- Different location
- Different time
- Multiple rapid transactions
- Incoming phone call
- Suspicious SMS
- OTP request

Risk Score:

0–30

Low Risk

31–70

Medium Risk

71–100

High Risk

---

## Security Features

Support demonstration of:

- Device fingerprinting
- OTP verification
- Call detection
- SMS detection
- Session monitoring
- Location mismatch
- Velocity checks
- AI anomaly detection

---

## AI Explanation

Every flagged transaction should include:

Reason for flagging.

Example:

"This transaction is unusually large compared to your historical average and originates from a new device."

---

## Admin Dashboard

Show:

Total Users

Flagged Transactions

Risk Distribution

Recent Alerts

Fraud Statistics

---

# Technology Stack

Frontend

- Next.js 15
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Framer Motion
- Lucide React

Backend

- Next.js API Routes
- Prisma
- PostgreSQL

Validation

- React Hook Form
- Zod

Charts

- Recharts

Tables

- TanStack Table

Notifications

- Sonner

Dates

- date-fns

Authentication

- Clerk or Auth.js

AI

Python FastAPI service (optional)

---

# Folder Structure

/app

/components

/components/ui

/features

/lib

/services

/hooks

/types

/utils

/prisma

/public

/styles

---

# UI Design

Professional fintech application.

Inspired by:

- Stripe
- Mercury
- Revolut Business
- Linear
- Ramp
- Vercel

Use:

- large whitespace
- rounded-xl
- subtle shadows
- premium typography
- responsive layouts

Never look like a student project.

---

# Design Principles

Always prefer:

Simple

Minimal

Professional

Readable

Accessible

Responsive

Consistent

---

# Color Palette

Primary Accent:

Deep Blue

Success:

Green

Warning:

Amber

Danger:

Red

Neutral Gray backgrounds

Avoid excessive gradients.

---

# Typography

Primary Font:

Geist

Fallback:

Inter

---

# Component Standards

Prefer:

shadcn/ui

Never reinvent components already provided.

Reuse components whenever possible.

---

# Security Standards

Always:

Validate inputs

Sanitize data

Protect API routes

Use server-side validation

Avoid exposing secrets

Follow OWASP principles

---

# Code Standards

Use strict TypeScript.

Avoid "any".

Use reusable components.

Keep files modular.

Avoid duplication.

Comment only complex logic.

Use descriptive naming.

---

# Performance

Lazy load large components.

Optimize images.

Minimize unnecessary renders.

Use memoization only when beneficial.

---

# Accessibility

Semantic HTML

Keyboard navigation

ARIA labels

Accessible colors

Responsive layout

---

# Development Workflow

Before implementing major features:

1. Explain architecture.

2. Explain files to modify.

3. Explain possible risks.

Then implement.

After implementation:

Review code.

Remove duplication.

Improve performance.

Fix bugs.

---

# Future Features

- Voice verification
- AI chatbot
- Face verification
- Bank API integration
- Real-time fraud detection
- Mobile companion app
- Multi-factor authentication
- Investment insights

---

# Final Goal

Every screen should appear production-ready.

Every feature should be scalable.

Every implementation should prioritize maintainability, security, and user experience.

Build as if this application will eventually be deployed by a real financial institution.