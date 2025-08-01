# Tea Time Rotation

This is a simple application to manage tea time for a team. It helps in keeping track of who's turn it is to make tea and what everyone's preferences are.

## Features

-   **User Management**: A predefined list of users is available.
-   **Order Management**: Users can submit their drink and sugar preferences for each tea time session. They can also update their order.
-   **Revoke Order**: Users can revoke their order for the current session.
-   **Session Management**: The application creates tea time sessions.
-   **Assignee Rotation**: The application automatically assigns whose turn it is to make tea based on who was assigned last.
-   **Order Summary**: A summary of all the orders is displayed, along with the assignee for the session.
-   **User Preferences**: The application remembers each user's last order and pre-fills the form for them.
-   **Drink Count**: The application keeps track of how many times each user has made tea.

## Tech Stack

-   **Frontend**: React, TypeScript, Tailwind CSS, Vite
-   **Backend**: Supabase (Database, Functions)

## How to run

1.  Clone the repository.
2.  Install the dependencies: `npm install`
3.  Create a `.env.local` file with your Supabase credentials (see `.env.example`).
4.  Run the development server: `npm run dev`
