# amrmek

This repository contains the Investor Network mobile and related plugins used for local development and CI testing.

See `mobile/` for the Expo/React Native app and the WordPress plugin code under the top-level plugin folders.

Development
1. Install dependencies: `npm ci` in `mobile/` and in plugin folders where needed
2. Start Metro: `npx expo start`
3. Run Android: `npx expo run:android` or use the dev client APK built by CI

CI
This repo includes a GitHub Actions workflow to build a debug Android APK and upload it as an artifact.
# Investor Network Mobile — Integration Guide

This repository contains the mobile client (React Native + Expo) and a small WordPress plugin (`investor-network-mobile-api.php`) that exposes REST endpoints for the Investor Network plugin.

Goals
- Provide a secure REST layer for a mobile app to interact with the Investor Network plugin.
- Use JWT for authentication (or Application Passwords for quick testing).
- Provide endpoints for listings, purchases, invoices, Stripe payment intents, and device token registration.

Quick start (development)

1. WordPress (local XAMPP) setup
   - Ensure your local WP site is reachable at `http://localhost/word` (or update the base URL in the mobile app `.env`).
   - Activate the following plugins in WordPress:
     - `investor-network` (main plugin)
     - `investor-network-mobile` (this mobile API plugin)
     - Recommended for JWT: `jwt-authentication-for-wp-rest-api` (or follow instructions below).

2. Install PHP dev tools (optional for running unit tests)
   - Composer is included in `bin/composer.phar` for convenience. To install dev dependencies:
     ```powershell
     cd wp-content/plugins/investor-network-mobile
     php ./bin/composer.phar install
     ```

3. Configure Stripe (test keys)
   - Set Stripe secret and publishable keys as WP options (or via `wp-config.php` in dev):
     - `investor_network_stripe_secret`
     - `investor_network_stripe_publishable`

4. Mobile app
   - Navigate to `wp-content/plugins/investor-network-mobile` — this repo contains the Expo project.
   - Copy `.env.example` to `.env` and update `REACT_APP_API_BASE` and Stripe keys.
   - Install deps and run:
     ```bash
     npm install
     npm run dev
     # or `expo start` in the mobile/ folder for the Expo app
     ```

JWT Authentication
- To use JWT auth, install the plugin `jwt-authentication-for-wp-rest-api`, and configure `JWT_AUTH_SECRET_KEY` in your `wp-config.php`.
- The mobile app expects an access token and optional refresh flow; the server-side plugin will use `jwt_auth_validate_token()` if available.

Postman
- A Postman collection with all mobile endpoints is included as `investor-network-mobile-api.postman_collection.json`.

Testing
- Unit tests for the plugin are scaffolded under `tests/` and can be run via PHPUnit (see `bin/install-wp-tests-windows.ps1` for Windows helper).

Security notes
- Mutating endpoints require authentication and ownership checks.
- Enforce HTTPS in production and configure allowed CORS origins.

If you want, I can:
- Commit these files and set up a small README in the root of the plugin (this file).
- Implement additional mobile screens or enhance JWT refresh logic.
# Investor Network Mobile App & API

This document provides instructions for setting up the WordPress REST API plugin and the React Native (Expo) mobile application for the Investor Network.

## Prerequisites

- WordPress >= 5.8
- PHP >= 7.4
- Node.js and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- A Stripe account for payment processing (test keys are sufficient).
- A tool for API testing like [Postman](https://www.postman.com/downloads/).

---

## 1. WordPress Backend Setup

### 1.1. Install Mobile API Plugin

1.  Take the code from `investor-network-mobile-api.php`.
2.  Create a new folder named `investor-network-mobile-api` inside your WordPress `wp-content/plugins/` directory.
3.  Inside that folder, create a file also named `investor-network-mobile-api.php` and paste the code into it.
4.  Navigate to **Plugins** in your WordPress admin dashboard, find "Investor Network Mobile API", and click **Activate**.

### 1.2. Install JWT Authentication Plugin

The mobile app uses JSON Web Tokens (JWT) for secure authentication.

1.  Install the [JWT Authentication for WP REST API](https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/) plugin.
2.  Activate the plugin.
3.  Add a secret key to your `wp-config.php` file. This key should be a long, random, and secret string.
    ```php
    define('JWT_AUTH_SECRET_KEY', 'your-highly-secret-key-here');
    ```
4.  Ensure your `.htaccess` file is configured for Authorization headers to work, especially on shared hosting. Add the following if you encounter issues:
    ```
    RewriteEngine on
    RewriteCond %{HTTP:Authorization} ^(.*)
    RewriteRule ^(.*) - [E=HTTP_AUTHORIZATION:%1]
    ```

### 1.3. Configure Bank Details

1.  In the WordPress admin, the `GET /bank-details` endpoint is configured to pull from an option named `investor_network_bank_transfer_info`.
2.  You can add/update this value by navigating to the hidden `options.php` page (`https://your-site.com/wp-admin/options.php`) and searching for the option name, or by using a tool like WP-CLI: `wp option update investor_network_bank_transfer_info "Your bank details here"`.

### 1.4. API Endpoints Overview

The plugin registers the following endpoints under `/wp-json/investor-network/v1`:

-   `GET /listings`: Get all investment listings.
-   `GET /listings/{id}`: Get details for a single listing.
-   `GET /listings/{id}/availability`: Get current share availability.
-   `POST /stripe/create-payment-intent`: Create a Stripe payment intent.
-   `POST /listings/{id}/purchase`: Record a completed purchase.
-   `GET /invoices`: Get the current user's invoices.
-   `POST /invoices/{id}/upload-receipt`: Upload a bank transfer receipt.
-   `POST /invoices/{id}/mark-paid`: Mark an invoice as paid (by user).
-   `GET /bank-details`: Get bank transfer instructions.
-   `POST /user/device-token`: Register a device token for push notifications.
-   `GET /user/profile`: Get the current user's profile.
-   `POST /user/profile`: Update the current user's profile.

---

## 2. React Native (Expo) Mobile App Setup

The mobile app source code is located in the `mobile/` directory.

### 2.1. Install Dependencies

Navigate to the mobile app directory and install the required packages.

```bash
cd mobile
npm install
```

### 2.2. Configure Environment Variables

1.  Create a new file named `.env` in the `mobile/` directory by copying the example file.
    ```bash
    cp .env.example .env
    ```
2.  Open the new `.env` file and edit the variables:
    -   `API_URL`: The base URL of your WordPress site (e.g., `https://example.com`). This should **not** include `/wp-json`.
    -   `STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key (e.g., `pk_test_...`).

### 2.3. Run the App

Start the Expo development server.

```bash
npx expo start
```

This will open a new browser tab with the Expo DevTools. You can run the app on:
- An iOS simulator (macOS only) by pressing `i`.
- An Android emulator by pressing `a`.
- A physical device by scanning the QR code with the Expo Go app.

---

## 3. API Testing (Postman)

A Postman collection is included in the root of the project (`Investor Network API.postman_collection.json`) to help you test the API endpoints.

### 3.1. Import the Collection

1.  Open Postman.
2.  Click **Import** and select the `Investor Network API.postman_collection.json` file.

### 3.2. Configure Environment

1.  It's recommended to create a Postman environment to store your variables like `baseUrl` and `authToken`.
2.  Create an environment with a variable `baseUrl` and set its value to your WordPress site URL (e.g., `https://example.com`).
3.  Run the **Auth > Login** request with valid WordPress credentials.
4.  The test script for the Login request will automatically save the received JWT to an `authToken` environment variable.
5.  All other requests in the collection are pre-configured to use `{{authToken}}` as the Bearer Token, so they will be automatically authenticated.

---

## 4. Testing Guidance

### 4.1. Server-Side Unit Tests (PHP)

For the `investor-network-mobile-api.php` plugin, it is recommended to use the standard WordPress unit testing suite, which is built on top of **PHPUnit**.

-   **Setup**: Follow the official WordPress guide to [set up a testing environment](https://developer.wordpress.org/cli/commands/scaffold/plugin-tests/).
-   **What to Test**:
    -   Create tests for each callback function of your REST endpoints.
    -   Mock the parts of the main Investor Network plugin that you are calling to isolate your API layer logic.
    -   Test permission callbacks with different user roles to ensure security is enforced.
    -   Test data sanitization and validation logic to prevent security vulnerabilities.

### 4.2. Mobile End-to-End (E2E) Tests

For the React Native (Expo) app, a framework like **Detox** or **Maestro** is recommended for E2E testing.

-   **Critical Flows to Test**:
    1.  **Login/Logout**: A user can successfully log in and log out.
    2.  **Browse Listings**: A logged-in user can see the list of investments and navigate to a detail screen.
    3.  **Purchase Flow (Stripe)**: A user can initiate a purchase, see the Stripe payment sheet, and (using mock Stripe data) complete the flow.
    4.  **Purchase Flow (Bank Transfer)**: A user can view bank details, proceed to the upload screen, and submit a mock receipt.
-   **Setup**: Follow the documentation for your chosen framework (e.g., [Detox with Expo](https://docs.expo.dev/build-reference/detox/)).

---

## 5. Deployment Notes

### 5.1. Building the App

When you are ready to build the app for production, you will use Expo's build service (EAS Build).

1.  Install the EAS CLI: `npm install -g eas-cli`.
2.  Log in to your Expo account: `eas login`.
3.  Configure your project for EAS Build: `eas build:configure`.
4.  Start a build for the desired platform:
    ```bash
    # For Android
    eas build -p android --profile preview

    # For iOS
    eas build -p ios --profile preview
    ```

### 5.2. Submitting to Stores

After the build is complete, EAS will provide you with the app binary (`.apk` or `.aab` for Android, `.ipa` for iOS). You can then submit these to the Google Play Store and Apple App Store.

For detailed instructions, refer to the official [Expo documentation on building and deploying](https://docs.expo.dev/build/introduction/).