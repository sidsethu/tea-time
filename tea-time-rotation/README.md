# Tea Time Rotation ☕

A beautiful, modern application to manage tea time for your team! Built with React, TypeScript, and Supabase, featuring a stunning glassmorphism UI design inspired by Material Design and Apple's design principles.

## ✨ Key Features

### 🎯 Core Functionality
-   **Smart User Management**: Predefined user list with the ability to add new users
-   **Intelligent Order System**: Quick-order interface with drink categories and instant sugar level selection
-   **Session Management**: Automated tea time session creation and management
-   **Assignee Rotation**: Automatic assignment rotation based on fairness algorithms
-   **Order Summary**: Beautiful summary dashboard with progress indicators
-   **Preference Memory**: Remembers each user's last order preferences

### 🔥 New Features & Improvements

#### 🚀 Enhanced UX
-   **Cookie-Based User Memory**: Automatically remembers and selects your last chosen user
-   **Quick Order Interface**: Click any drink + sugar level combination to instantly place orders
-   **Real-time Progress Tracking**: Visual progress bar showing order completion status
-   **Smart Dropdown**: Elegant user selection with visual order status indicators

#### 🎨 Beautiful Design
-   **Glassmorphism UI**: Modern glass-effect design with backdrop blur effects
-   **Material Design**: Following Google's Material Design principles
-   **Apple Glass UI**: Inspired by Apple's latest glass UI design language
-   **Animated Backgrounds**: Subtle floating elements and gradient animations
-   **Responsive Design**: Perfect on desktop, tablet, and mobile devices

#### 🔧 Hidden Features
-   **Admin Panel**: Click the teapot emoji 🫖 5 times to reveal the "Add New User" panel
-   **Quick Actions**: Streamlined interface for faster order placement
-   **Visual Feedback**: Toast notifications and success animations

#### 🛠 Technical Improvements
-   **Direct Database Operations**: Optimized user creation with duplicate checking and validation
-   **Error Handling**: Comprehensive error handling with user-friendly messages
-   **Performance**: Optimized rendering and smooth animations
-   **Accessibility**: WCAG compliant with proper ARIA labels and keyboard navigation

## 🛠 Tech Stack

-   **Frontend**: React 19, TypeScript, Tailwind CSS 4, Vite 7
-   **Backend**: Supabase (PostgreSQL Database, Edge Functions)
-   **Design**: Material UI principles, Apple Glass UI, Glassmorphism
-   **State Management**: React Hooks with Cookie persistence

## 🚀 Quick Start

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd tea-time-rotation
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file with your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  **Open your browser:**
    Navigate to `http://localhost:5173` and start managing your tea time! ☕

## 🎯 How to Use

### For Regular Users:
1. **Select Your Name**: Choose yourself from the dropdown (it remembers your choice!)
2. **Quick Order**: Click any drink + sugar level combination to instantly place your order
3. **Track Progress**: Watch the beautiful progress bar fill up as everyone orders

### For Admins:
1. **Access Hidden Panel**: Click the teapot emoji 🫖 exactly 5 times
2. **Add New Users**: Use the glass-effect modal to add new team members
3. **Manage Sessions**: Start and summarize tea time sessions

### Features in Action:
- 🍵 **Drink Categories**: Hot Drinks, Milk Drinks, Cold Drinks
- 🍯 **Sugar Options**: No Sugar, Less, Normal
- 📊 **Real-time Updates**: See who has ordered in real-time
- 🔄 **Order Management**: Revoke and update orders easily

## 🎨 Design Philosophy

This application showcases modern design principles:

- **Glassmorphism**: Semi-transparent elements with backdrop blur effects
- **Material Design 3**: Google's latest design system with dynamic theming
- **Apple Glass UI**: Inspired by iOS/macOS glass effects
- **Accessibility First**: WCAG 2.1 AA compliant with proper contrast ratios
- **Mobile-First**: Responsive design that works beautifully on all devices

## 🤝 Contributing

We welcome contributions! Please feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 📄 License

This project is built with ❤️ for tea lovers everywhere! ☕✨
