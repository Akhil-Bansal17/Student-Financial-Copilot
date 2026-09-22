# Product Vision: Student Financial Copilot

## 1. Executive Summary

**Student Financial Copilot** is a student-first personal finance platform built to help college and university students transition from chaotic ad-hoc spending to financial clarity and confidence.

Unlike corporate accounting software or bank dashboards designed for salaried professionals with mortgages, Student Financial Copilot is crafted around the reality of student life: variable allowances, shared hostel expenses, canteen food runs, last-minute textbook costs, and tight monthly allowances.

---

## 2. Target User Persona

- **Primary Persona**: College / university students (undergraduate and postgraduate), typically aged 18–24.
- **Financial Context**:
  - Irregular pocket money / parental transfers or student loan disbursements
  - Micro-transactions via digital payment rails (UPI, debit cards)
  - Fixed recurring overhead (hostel rent, mess fees, semester books, subscriptions like Netflix/Spotify)
  - Variable lifestyle expenses (canteen, coffee, transit, weekend outings)
- **Pain Points**:
  - "I look at my bank balance at the end of the 2nd week of the month and wonder where ₹3,000 went."
  - Guilt and anxiety around spending without clarity on what is genuinely discretionary.
  - Traditional budgeting tools require tedious 40-step categorization and spreadsheet mastery.

---

## 3. Product Vision & Emotional Tone

The application should feel:
- **Modern & Friendly**: Clean typography, welcoming greetings, approachable terminology.
- **Trustworthy & Financially Responsible**: High precision, clear breakdown of commitments, no deceptive gamification.
- **Simple & Fast**: The student should comprehend their financial posture in **under 3 seconds** upon opening the app.
- **Slightly Playful, Never Corporate**: Positive reinforcement for disciplined habits without annoying corporate jargon.

---

## 4. Mobile-First Philosophy

Student finances happen on the go: at a campus coffee cart, standing at a metro ticket counter, or splitting a meal bill at a dinner table.

- **Primary Target**: Mobile phone browsers and installable Progressive Web App (PWA).
- **Core Viewports**: 320px, 375px, 390px, 412px, 430px.
- **Key Ergonomics**:
  - Thumb-reachable navigation anchored at the bottom of the screen.
  - Large, comfortable touch targets (minimum 44px).
  - Clear readability with high contrast and zero horizontal scroll.
  - One-handed operation for common actions.
- **Progressive Desktop Enhancement**: Desktop users receive an expanded sidebar and multi-column dashboard layout that utilizes extra screen real estate without compromising simplicity.

---

## 5. Non-Negotiable AI & Financial Integrity Principles

1. **Deterministic Backend Truth**:
   The backend domain logic is the **sole source of truth** for all numbers:
   - Account balances
   - Total spent
   - Safe-to-spend calculations
   - Goal progress metrics
   - Burn rates and runway forecasts

2. **The Role of AI**:
   - The LLM/AI layer will **never compute balances or transaction math**.
   - AI serves strictly as an **evidence-based interpreter**: synthesizing verified data into encouraging, actionable guidance.
   - Every AI recommendation must cite the underlying verified metrics (e.g., *"Based on your ₹5,720 spent this month and 8 days remaining..."*).
