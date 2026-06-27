# Clutch AI — Architecture Map

> **Version**: 2.3.0 — Autonomous OS & Realtime Database Sync Release  
> **Stack**: Next.js 15 App Router · TypeScript · TailwindCSS v4 · shadcn/ui · Supabase · Framer Motion · TanStack Query · Gemini 1.5 Flash · Groq Llama 3.3

---

## Directory Structure

```
taskify/
├── src/
│   ├── app/
│   │   ├── (marketing)/                  # Public landing page (no auth required)
│   │   │   ├── layout.tsx                # Pass-through layout
│   │   │   └── page.tsx                  # Landing page (Hero + Features + How It Works + Testimonials + Pricing + CTA)
│   │   │
│   │   ├── (auth)/                       # Authentication route group
│   │   │   ├── layout.tsx                # Auth shell with branded nav
│   │   │   ├── login/page.tsx            # Login page (wraps LoginForm in Suspense)
│   │   │   ├── signup/page.tsx           # Signup page
│   │   │   └── forgot-password/page.tsx  # Forgot password page
│   │   │
│   │   ├── (app)/                        # Protected app route group (requires auth)
│   │   │   ├── layout.tsx                # App shell — Sidebar + Header, validates session
│   │   │   ├── dashboard/page.tsx        # Dashboard — stats, autonomous widgets, active missions
│   │   │   ├── mission-control/page.tsx  # AI chat interface (Mission Control)
│   │   │   ├── tasks/page.tsx            # Task management CRUD board & Strategic Goals
│   │   │   ├── calendar/page.tsx         # Sleek interactive daily timeline grid with auto-scheduling actions
│   │   │   ├── settings/page.tsx         # Settings with AI Personality selectors
│   │   │   └── profile/page.tsx          # User profile + activity log
│   │   │
│   │   ├── api/
│   │   │   ├── auth/callback/route.ts    # OAuth PKCE callback handler
│   │   │   ├── ai/
│   │   │   │   ├── chat/route.ts         # Autonomous JSON Synchronous Transaction API Route
│   │   │   │   ├── extract/route.ts      # Multimodal Document & File Task Ingest Route
│   │   │   │   └── goals/route.ts        # Milestone Auto-Decomposition API Route
│   │   │   └── tasks/
│   │   │       ├── route.ts              # GET (list + filter) / POST (create)
│   │   │       └── [id]/route.ts         # GET / PATCH / DELETE single task
│   │   │
│   │   ├── layout.tsx                    # Root layout (Inter font, Confetti, providers, Toaster)
│   │   └── globals.css                   # Design system (OKLCH tokens, animations, glass)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx               # Animated collapsible sidebar + mobile tab nav
│   │   │   ├── header.tsx                # App header with page title + actions
│   │   │   └── notification-center.tsx   # Bell dropdown showing context blocker, urgency, and workload notifications
│   │   │
│   │   ├── shared/
│   │   │   └── confetti-canvas.tsx       # High-performance HTML5 canvas particle generator for celebrations
│   │   │
│   │   ├── landing/
│   │   │   ├── hero.tsx                  # Typewriter demo + animated task extraction
│   │   │   ├── features.tsx              # 6-card features grid with scroll animation
│   │   │   ├── how-it-works.tsx          # 4-step process with connector line
│   │   │   ├── testimonials.tsx          # 6 testimonial cards with star ratings
│   │   │   ├── pricing.tsx               # 3 plan cards with "Coming Soon" overlay
│   │   │   └── cta.tsx                   # Full-width CTA with orb background
│   │   │
│   │   ├── auth/
│   │   │   ├── login-form.tsx            # Email + Google OAuth login
│   │   │   ├── signup-form.tsx           # Registration with validation
│   │   │   └── forgot-password-form.tsx  # Password reset flow
│   │   │
│   │   ├── dashboard/
│   │   │   ├── quick-stats.tsx           # 4 animated metric cards
│   │   │   ├── today-missions.tsx        # Active tasks with progress rings
│   │   │   ├── upcoming-deadlines.tsx    # Deadline timeline with overdue flags
│   │   │   ├── custom-charts.tsx         # Animated zero-dependency SVG curves for productivity and forecasts
│   │   │   ├── autonomous-widgets.tsx    # Next Best Action, Heatmap, Radial Score, Work Blocks, Predictions, Burnout Stress Gauge, Streaks Medals
│   │   │   ├── focus-session-timer.tsx   # Pomodoro focus session widget with synthesized audio chimes
│   │   │   └── productivity-summary.tsx  # Animated bar chart placeholder
│   │   │
│   │   ├── mission-control/
│   │   │   ├── chat-interface.tsx        # Main orchestrator (stream JSON parsing, provider state, voice coach trigger)
│   │   │   ├── voice-assistant-modal.tsx # SpeechRecognition + speaking SpeechSynthesis conversational coach overlay
│   │   │   ├── chat-message.tsx          # Renders markdown bubbles + rich visual action cards
│   │   │   ├── chat-input.tsx            # Speech-to-Text, Multimodal uploader, Quick Modes (Email/Cal)
│   │   │   ├── suggested-prompts.tsx     # 4 example prompt cards (empty state)
│   │   │   └── conversation-history.tsx  # History sidebar with conversation list
│   │   │
│   │   └── tasks/
│   │       ├── task-card.tsx             # Card with priority, deadline, ring, actions
│   │       ├── task-list.tsx             # Grouped by status, collapsible sections
│   │       ├── task-form.tsx             # Create/Edit modal (React Hook Form + Zod)
│   │       ├── task-filters.tsx          # Search + status + priority filters
│   │       └── goal-board.tsx            # Goals, Milestones, and AI Decomposed task tracker
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Browser Supabase client (@supabase/ssr)
│   │   │   └── server.ts                 # Server Supabase client (RSC/Route Handlers)
│   │   ├── api/
│   │   │   ├── tasks.ts                  # fetchTasks, createTask, updateTask, deleteTask, etc.
│   │   │   └── conversations.ts          # fetchConversations, createConversation, messages
│   │   ├── ai/
│   │   │   ├── ai-service.ts             # Central Autonomous prompt architecture & mathematical Priority Engine
│   │   │   ├── context-builder.ts        # Parallel-loads memories, settings, tasks, and plans for context injection
│   │   │   ├── memory-service.ts         # User habits, study times, and work hours long-term memory extraction
│   │   │   ├── planner-service.ts        # Hour-blocked work plans, rescheduling, and Next Best Action
│   │   │   ├── dependency-engine.ts      # Task cycle checks and critical path priority boosting
│   │   │   ├── probability-engine.ts     # Dynamic completion probability scoring and history log upserts
│   │   │   ├── coach-service.ts          # Proactive smart coaching cards & micro-task wins
│   │   │   ├── notification-engine.ts    # Blocker alerts and workload savings notifications
│   │   │   ├── analytics-service.ts      # Aggregates completed hours, trends, streaks, and peak times
│   │   │   ├── goal-service.ts           # Decomposes milestones into actionable tasks using Gemini
│   │   │   ├── reminder-service.ts       # Parses relative/specific times and inserts persistent reminders
│   │   │   └── action-orchestrator.ts    # Transactional coordinator with logical rollback error handling
│   │   ├── gemini/
│   │   │   └── client.ts                 # Gemini & Groq stream router with dynamic system instructions
│   │   └── utils.ts                      # cn(), formatDeadline, formatDuration, getInitials, etc.
│   │
│   ├── hooks/
│   │   └── use-tasks.ts                  # useTasks, useCreateTask, useUpdateTask, useDeleteTask, etc.
│   │
│   ├── providers/
│   │   ├── query-provider.tsx            # TanStack Query v5 provider with devtools
│   │   ├── supabase-provider.tsx         # Auth session context (onAuthStateChange)
│   │   └── realtime-sync-provider.tsx    # Subscribes client to public changes, invalidates caches & refreshes DOM
│   │
│   ├── types/
│   │   ├── database.types.ts             # Full Supabase schema TypeScript types
│   │   └── app.types.ts                  # Enums, UI config maps, API response types
│   │
│   └── middleware.ts                     # Auth middleware — protects /dashboard, /tasks, etc.
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql        # Full base DB schema with RLS policies
│       ├── 002_autonomous_extensions.sql # Extended schema for autonomous tracking, plans, and scores
│       ├── 003_phase2_companion.sql      # Goal, milestone, memory, focus timer, and analytics schema extensions
│       └── 004_reminder_system.sql       # Persistent reminder schema, triggers, and security policies
│
├── .env.local.example                    # Environment variable template
├── next.config.ts                        # Next.js config
├── tsconfig.json                         # TypeScript strict config
├── postcss.config.mjs                    # PostCSS for TailwindCSS v4
└── map.md                                # This file
```

---

## Database Schema

### Table Overview

| Table | Description | RLS |
|---|---|---|
| `users` | User profiles (extends auth.users via trigger) | ✅ Own data only |
| `conversations` | AI chat conversation sessions | ✅ Own conversations |
| `messages` | Individual chat messages | ✅ Via conversation ownership |
| `tasks` | Core task model with Priority, Risk, and Milestone relations | ✅ Own tasks |
| `subtasks` | Task checklist items (AI chunked) | ✅ Via task ownership |
| `execution_plans` | Daily/weekly schedules generated by AI | ✅ Own plans |
| `productivity_scores` | Analytics streaks, calculated scores, and coaching logs | ✅ Own scores |
| `user_memories` | Long-term user preferences, work hours, and study habits | ✅ Own memories |
| `goals` | Strategic high-level goals | ✅ Own goals |
| `milestones` | Key milestones under goals | ✅ Via goal ownership |
| `focus_sessions` | Time logs for pomodoros and deep-work sessions | ✅ Own sessions |
| `productivity_analytics_history` | 14-day rolling analytics, streaks, and probabilities | ✅ Own analytics |
| `reminders` | Persistent specific, relative, and recurring notifications | ✅ Own reminders |
| `activity_logs` | Action history (immutable logs) | ✅ Read/insert own |
| `settings` | User preferences and active AI Personality core | ✅ Own settings |

---

## Multi-Model AI Layer Architecture

The AI layer supports two modes of execution toggled dynamically at the bottom of the chat interface:
1.  **Groq Mode (Llama 3.3 70B)**:
    *   Text-only mode.
    *   Ultra-fast streaming and task extraction utilizing native Llama 3 JSON mode.
    *   Supports dynamic `systemInstruction` overrides for custom context injections.
2.  **Gemini Mode (Gemini 1.5 Flash)**:
    *   Primary intelligence engine for all advanced features.
    *   Multimodal support for files, PDFs, and image parses.
    *   Powers the Goal Decomposer, Adaptive Rescheduling, Context Builder, and Smart Coaching.

---

## Component Hierarchy

```
RootLayout
├── SupabaseProvider (auth session context)
├── QueryProvider (TanStack Query)
├── RealtimeSyncProvider (client-side DB sync listener)
├── ConfettiCanvas (celebrations overlay)
├── Toaster (Sonner notifications)
└── RouteGroups
    ├── (marketing)
    │   └── LandingPage
    ├── (auth)
    │   └── AuthLayout
    └── (app)
        └── AppLayout
            ├── Sidebar (collapsible, mobile bottom nav)
            ├── Header (page title, search, NotificationCenter bell)
            └── Pages
                ├── DashboardPage
                │   ├── QuickStats (4 metric cards)
                │   ├── CustomCharts (Productivity Area + Success Line curves)
                │   ├── AutonomousWidgets
                │   │   ├── AI Daily Brief & Predictions (top summary bar)
                │   │   ├── NextBestAction (optimal task highlights)
                │   │   ├── BurnoutStressGauge (bio-load thermometer bar)
                │   │   ├── FocusSessionTimer (pomodoro timer + audio context chimes)
                │   │   ├── DeadlineHeatmap (14-day Git-style grid)
                │   │   ├── TodayWorkBlocks (hour-blocked planners)
                │   │   ├── ProductivityScoreGauge (radial progress ring + streak flame)
                │   │   ├── AchievementsBadgeGrid (streaks & focus medals)
                │   │   └── SmartCoachCallout (micro-wins & encouragement)
                │   ├── TodayMissions (active tasks)
                │   └── UpcomingDeadlines (sorted timeline)
                ├── MissionControlPage
                │   └── ChatInterface (Voice Coach trigger button)
                │       ├── VoiceAssistantModal (speaking dialogue overlay)
                │       ├── ConversationHistory (sidebar)
                │       ├── ChatMessage (markdown + visual plan cards)
                │       ├── SuggestedPrompts (empty state)
                │       └── ChatInput (mic, uploader, switcher)
                ├── TasksPage
                │   ├── Sliding Tab Switcher (Active Board vs. Strategic Goals)
                │   ├── Active Board
                │   ├── Strategic Goals
                │   │   └── GoalBoard (Goals, Milestones, and Decomposed Tasks)
                │   └── TaskForm (modal, create/edit)
                ├── CalendarPage (hourly blocks planner + AI Auto-Schedule)
                ├── SettingsPage (AI Personality Core switcher + notification toggles)
                └── ProfilePage (user + activity log)
```
