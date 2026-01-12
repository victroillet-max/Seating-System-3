# Seating Manager

A collaborative seating management application for sport catering events. All users share the same data in real-time through a PostgreSQL database.

## Features

- **Manager View**: Full control over guests, tables, and assignments
- **Waiter View**: Simplified interface for check-ins and reassignments
- **Weekly Planning**: Manage seating across 7 days and 3 services
- **Room Layout Editor**: Drag-and-drop table positioning
- **Real-time Sync**: All users see the same data via shared database
- **Guest Import**: Bulk import guests via CSV format
- **Arrival Tracking**: Track guest arrivals per day
- **Table Blocking**: Temporarily block tables from assignments
- **Weekly Summary**: Analytics and statistics dashboard

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Database**: Vercel Postgres (PostgreSQL)
- **Deployment**: Vercel

## Deployment to Vercel

### 1. Push to GitHub

Create a new repository on GitHub and push this code:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/seating-manager.git
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js settings

### 3. Add Vercel Postgres Database

1. In your Vercel project dashboard, go to **Storage**
2. Click **Create Database** → **Postgres**
3. Give it a name (e.g., "seating-db")
4. Click **Create**
5. The database will be automatically connected to your project

The `POSTGRES_URL` and related environment variables are automatically added to your project.

### 4. Initialize the Database

After deployment, the database tables will be created automatically on first load. You can also manually initialize by visiting:

```
https://your-app.vercel.app/api/init
```

## Local Development

### Prerequisites

- Node.js 18+
- A Vercel account with Postgres database

### Setup

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/seating-manager.git
cd seating-manager
```

2. Install dependencies:
```bash
npm install
```

3. Pull environment variables from Vercel:
```bash
vercel env pull .env.local
```

Or create `.env.local` manually with your Postgres credentials:
```env
POSTGRES_URL="..."
POSTGRES_PRISMA_URL="..."
POSTGRES_URL_NON_POOLING="..."
POSTGRES_USER="..."
POSTGRES_HOST="..."
POSTGRES_PASSWORD="..."
POSTGRES_DATABASE="..."
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Database Schema

The application uses 5 tables:

- **guests**: Guest information (name, party size, notes)
- **tables**: Table configuration (name, capacity, x/y position)
- **assignments**: Links guests to tables for specific day/service
- **arrivals**: Tracks guest arrival status per day
- **blocked_tables**: Tables blocked for specific day/service

## API Endpoints

- `GET/POST /api/guests` - Manage guests
- `GET/POST/PUT/DELETE /api/tables` - Manage tables
- `GET/POST/DELETE /api/assignments` - Manage seating assignments
- `GET/POST /api/arrivals` - Track guest arrivals
- `GET/POST /api/blocked-tables` - Manage blocked tables
- `GET/POST /api/init` - Initialize database

## Usage

### Manager View

1. **Add Guests**: Click "Add Guest" or use "Import" for bulk import
2. **Assign Guests**: Click a guest, then click a table to assign
3. **Move Guests**: Click the arrow icon on an assigned guest
4. **Block Tables**: Click the X icon on a table to block it
5. **Edit Layout**: Click "Edit Room Layout" to drag tables

### Waiter View

1. **Check In Guests**: Tap the circle next to a guest name
2. **Search**: Use the search bar to find guests quickly
3. **Reassign**: Tap the move icon then select a new table
4. **Room Overview**: Visual map shows table status

### Import Format

Import guests as CSV (one per line):
```
John Smith, 4, VIP
Jane Doe, 2
Bob Johnson, 6, Vegetarian
```

Format: `Name, Party Size, Notes`

## License

MIT
