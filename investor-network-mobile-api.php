<?php
/**
 * Plugin Name: Investor Network Mobile API
 * Description: REST API endpoints for mobile app integration with Investor Network plugin.
 * Version: 1.0
 * Author: Generated
 */

defined( 'ABSPATH' ) || exit;

// Early CORS responder for preflight and to ensure headers are present
// This runs very early so even error responses or redirects include CORS headers
if ( isset( $_SERVER['HTTP_ORIGIN'] ) ) {
    $origin = esc_url_raw( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) );
    if ( false !== strpos( $origin, 'localhost' ) || false !== strpos( $origin, '127.0.0.1' ) || strpos( $origin, 'http://localhost:3000' ) === 0 ) {
        header( 'Access-Control-Allow-Origin: ' . $origin );
        header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
        header( 'Access-Control-Allow-Credentials: true' );
        header( 'Access-Control-Allow-Headers: Origin, Authorization, Content-Type, Accept, X-Requested-With, X-WP-Nonce' );
        header( 'Vary: Origin' );
    }
}

// Short-circuit OPTIONS requests early so preflight always succeeds
if ( isset( $_SERVER['REQUEST_METHOD'] ) && strtoupper( $_SERVER['REQUEST_METHOD'] ) === 'OPTIONS' ) {
    // Only short-circuit for REST paths (safety)
    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : '';
    if ( stripos( $request_uri, '/wp-json/' ) !== false ) {
        status_header( 200 );
        // Send an empty body and exit
        echo ''; exit;
    }
}

// Mobile API: basic CORS and HTTPS enforcement helper.
if ( ! function_exists( 'investor_network_mobile_send_cors_headers' ) ) {
    add_action( 'rest_api_init', function() {
        // Allow the exposed endpoints to set CORS headers on preflight and responses
        add_filter( 'rest_pre_serve_request', function( $served, $result, $request, $server ) {
            $allowed = get_option( 'investor_mobile_allowed_origins', '' );
            if ( empty( $allowed ) ) {
                // fallback to main site URL
                $allowed = get_site_url();
            }

            // Safely read the incoming Origin header
            $origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) : '';
            $allowed_list = array_map( 'trim', explode( ',', $allowed ) );

            $use_origin = false;
            if ( $origin ) {
                // Exact match with configured allowed origins
                if ( in_array( $origin, $allowed_list, true ) ) {
                    $use_origin = true;
                }
                // Allow common local dev host (including port) to ease Vite-based dev setups
                if ( false !== strpos( $origin, 'localhost' ) || false !== strpos( $origin, '127.0.0.1' ) ) {
                    $use_origin = true;
                }
                // Also allow Vite default host explicitly for convenience
                if ( strpos( $origin, 'http://localhost:3000' ) === 0 ) {
                    $use_origin = true;
                }
            }

            // If we decided to echo the origin, use it; otherwise fall back to configured allowed value
            if ( $use_origin && $origin ) {
                header( 'Access-Control-Allow-Origin: ' . $origin );
            } else {
                header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $allowed ) );
            }

            // Common CORS response headers (allow credentials for cookie/JWT workflows)
            header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
            header( 'Access-Control-Allow-Credentials: true' );
            header( 'Access-Control-Allow-Headers: Origin, Authorization, Content-Type, Accept, X-Requested-With, X-WP-Nonce' );

            // If this is a preflight request, short-circuit with 200 and ensure headers are present
            if ( isset( $_SERVER['REQUEST_METHOD'] ) && 'OPTIONS' === strtoupper( $_SERVER['REQUEST_METHOD'] ) ) {
                status_header( 200 );
                // Terminate early for OPTIONS requests
                exit;
            }

            return $served;
        }, 15, 4 );
    } );
}

// Filter to prefer the custom stored avatar for users when available.
add_filter( 'get_avatar_url', 'investor_network_mobile_get_custom_avatar_url', 10, 3 );

function investor_network_mobile_get_custom_avatar_url( $url, $id_or_email, $args ) {
    $user_id = 0;
    if ( is_numeric( $id_or_email ) ) {
        $user_id = intval( $id_or_email );
    } elseif ( is_object( $id_or_email ) && ! empty( $id_or_email->user_id ) ) {
        $user_id = intval( $id_or_email->user_id );
    } elseif ( is_string( $id_or_email ) ) {
        // Maybe an email address
        $user = get_user_by( 'email', $id_or_email );
        if ( $user ) $user_id = $user->ID;
    }

    if ( $user_id ) {
        $avatar_meta = get_user_meta( $user_id, 'investor_custom_avatar', true );
        if ( ! empty( $avatar_meta ) ) {
            if ( is_numeric( $avatar_meta ) ) {
                $custom = wp_get_attachment_image_url( intval( $avatar_meta ), isset( $args['size'] ) ? $args['size'] : 'thumbnail' );
                if ( $custom ) return $custom;
            } elseif ( is_string( $avatar_meta ) ) {
                return esc_url_raw( $avatar_meta );
            }
        }
    }

    return $url;
}

// Helper to enforce HTTPS for mutating endpoints (returns WP_Error on failure)
if ( ! function_exists( 'investor_network_mobile_require_secure' ) ) {
    function investor_network_mobile_require_secure() {
        // Allow local HTTP if WP_DEBUG is true
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            return true;
        }
        if ( is_ssl() ) {
            return true;
        }
        return new WP_Error( 'rest_forbidden', 'HTTPS required', array( 'status' => 403 ) );
    }
}

/**
 * Run lightweight DB migrations needed by the mobile API.
 * Currently ensures `invoice_id` column exists on the purchases table.
 */
function investor_network_mobile_run_migrations() {
    global $wpdb;
    $purchases_table = $wpdb->prefix . 'investor_network_share_purchases';

    // Check if column exists
    $col = $wpdb->get_var( $wpdb->prepare( "SHOW COLUMNS FROM {$purchases_table} LIKE %s", 'invoice_id' ) );
    if ( $col ) {
        // already present
        return true;
    }

    // Add column safely
    try {
        $sql = "ALTER TABLE {$purchases_table} ADD COLUMN invoice_id bigint(20) DEFAULT NULL";
        $res = $wpdb->query( $sql );
        if ( $res === false ) {
            error_log( 'Mobile API migration: failed to add invoice_id column: ' . $wpdb->last_error );
            return false;
        }
        error_log( 'Mobile API migration: added invoice_id column to ' . $purchases_table );
        return true;
    } catch ( Exception $e ) {
        error_log( 'Mobile API migration exception: ' . $e->getMessage() );
        return false;
    }
}

// Previously we ran lightweight migrations automatically on plugin load which
// can be unsafe on production sites. Instead expose a WP-CLI command to run
// migrations manually and show an admin notice for site admins when a
// migration is pending.
if ( defined( 'WP_CLI' ) && WP_CLI ) {
    // Register a simple WP-CLI command: `wp investor-network-mobile migrate`
    if ( ! class_exists( 'Investor_Network_Mobile_CLI' ) ) {
        class Investor_Network_Mobile_CLI {
            /**
             * Run mobile API migrations.
             *
             * ## EXAMPLES
             *
             *     wp investor-network-mobile migrate
             */
            public function migrate( $args = array(), $assoc_args = array() ) {
                if ( investor_network_mobile_run_migrations() ) {
                    \WP_CLI::success( 'Investor Network Mobile: migrations applied.' );
                } else {
                    \WP_CLI::error( 'Investor Network Mobile: migrations failed. Check debug.log for details.' );
                }
            }
        }
    }
    \WP_CLI::add_command( 'investor-network-mobile', 'Investor_Network_Mobile_CLI' );
} else {
    // For non-CLI usage (HTTP requests), don't alter schema automatically.
    // Instead, show a one-time admin notice to administrators if the
    // `invoice_id` column is missing so they can run the WP-CLI migration.
    add_action( 'admin_notices', function() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }
        global $wpdb;
        $purchases_table = $wpdb->prefix . 'investor_network_share_purchases';
        $col = $wpdb->get_var( $wpdb->prepare( "SHOW COLUMNS FROM {$purchases_table} LIKE %s", 'invoice_id' ) );
        if ( ! $col ) {
            echo '<div class="notice notice-warning"><p>Investor Network Mobile API: database migration pending. Run <code>wp investor-network-mobile migrate</code> from the command line to apply required schema changes (adds the <code>invoice_id</code> column to purchases).</p></div>';
        }
    } );
}

// Check if main plugin is active. If not present yet, show an admin notice
// but do not abort loading — defer REST registration until plugins are loaded
if ( ! defined( 'INVESTOR_NETWORK_PLUGIN_DIR' ) ) {
    add_action( 'admin_notices', function() {
        echo '<div class="notice notice-error"><p>Investor Network Mobile API requires the main Investor Network plugin to be active.</p></div>';
    } );

    // Defer registering the REST routes until after plugins are loaded so the
    // main plugin has a chance to define its constants and classes.
    add_action( 'plugins_loaded', function() {
        if ( defined( 'INVESTOR_NETWORK_PLUGIN_DIR' ) ) {
            add_action( 'rest_api_init', 'investor_network_mobile_register_routes' );
        }
    }, 20 );
} else {
    // Main plugin already present; register routes immediately on rest_api_init
    add_action( 'rest_api_init', 'investor_network_mobile_register_routes' );
}

// Include main plugin classes if available; otherwise skip — the main plugin may load later.
if ( defined( 'INVESTOR_NETWORK_PLUGIN_DIR' ) ) {
    require_once INVESTOR_NETWORK_PLUGIN_DIR . 'includes/class-investor-network-loader.php';
    require_once INVESTOR_NETWORK_PLUGIN_DIR . 'includes/class-investor-network.php';
}

function investor_network_mobile_register_routes() {
    $namespace = 'investor-network/v1';

    // Listings
    register_rest_route( $namespace, '/listings', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_listings',
        'permission_callback' => '__return_true',
        'args' => array(
            'page' => array( 'default' => 1, 'sanitize_callback' => 'absint' ),
            'per_page' => array( 'default' => 10, 'sanitize_callback' => 'absint' ),
            'status' => array( 'default' => 'active', 'sanitize_callback' => 'sanitize_text_field' ),
        ),
    ) );

    register_rest_route( $namespace, '/listings/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_listing',
        'permission_callback' => '__return_true',
        'args' => array( 'id' => array( 'validate_callback' => function( $param, $request, $key ) { return is_numeric( $param ); } ) ),
    ) );

    register_rest_route( $namespace, '/listings/(?P<id>\d+)/availability', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_availability',
        'permission_callback' => '__return_true',
        'args' => array( 'id' => array( 'validate_callback' => function( $param, $request, $key ) { return is_numeric( $param ); } ) ),
    ) );

    // Proposal-level availability (used by mobile client when showing proposals list)
    register_rest_route( $namespace, '/proposals/(?P<id>\d+)/availability', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_availability',
        'permission_callback' => '__return_true',
        'args' => array( 'id' => array( 'validate_callback' => function( $param, $request, $key ) { return is_numeric( $param ); } ) ),
    ) );

    // Secondary listings per-proposal (normalized sell_request / listing rows)
    register_rest_route( $namespace, '/proposals/(?P<id>\d+)/secondary-listings', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_proposal_secondary_listings',
        'permission_callback' => '__return_true',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    // Purchase a proposal (primary market) — supports JWT via investor_network_mobile_check_auth
    register_rest_route( $namespace, '/proposals/(?P<id>\d+)/purchase', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_purchase_proposal',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array(
            'id' => array( 'validate_callback' => function( $param, $request, $key ) { return is_numeric( $param ); } ),
            'quantity' => array( 'required' => true, 'sanitize_callback' => 'absint' ),
            'payment_method' => array( 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
            'payment_payload' => array( 'validate_callback' => function( $param, $request, $key ) { return true; } ),
        ),
    ) );

    // Purchase
    register_rest_route( $namespace, '/listings/(?P<id>\d+)/purchase', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_purchase_listing',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array(
            'id' => array( 'validate_callback' => function( $param, $request, $key ) { return is_numeric( $param ); } ),
            'quantity' => array( 'required' => true, 'sanitize_callback' => 'absint' ),
            'payment_method' => array( 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
            // payment_payload may be an object/array (e.g. card info, metadata).
            // Accept any shape and avoid WP's string-only sanitizers which can cause fatal errors.
            'payment_payload' => array( 'validate_callback' => function( $param, $request, $key ) { return true; } ),
        ),
    ) );

    // Stripe Payment Intent
    register_rest_route( $namespace, '/stripe/create-payment-intent', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_create_stripe_intent',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array(
            'amount' => array( 'required' => true, 'sanitize_callback' => 'floatval' ),
            'currency' => array( 'default' => 'usd', 'sanitize_callback' => 'sanitize_text_field' ),
            'listing_id' => array( 'sanitize_callback' => 'absint' ),
        ),
    ) );

    // Invoices
    register_rest_route( $namespace, '/invoices', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_invoices',
        'permission_callback' => 'investor_network_mobile_check_auth',
    ) );

    register_rest_route( $namespace, '/invoices/(?P<id>\d+)/upload-receipt', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_upload_receipt',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'validate_callback' => function( $param, $request, $key ) { return is_numeric( $param ); } ) ),
    ) );

    register_rest_route( $namespace, '/invoices/(?P<id>\d+)/mark-paid', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_mark_invoice_paid',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'validate_callback' => function( $param, $request, $key ) { return is_numeric( $param ); } ) ),
    ) );

    // Bank Details
    register_rest_route( $namespace, '/bank-details', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_bank_details',
        'permission_callback' => '__return_true',
    ) );

    // Settings - get or update user settings (notification preferences etc.)
    register_rest_route( $namespace, '/settings', array(
        array(
            'methods' => 'GET',
            'callback' => 'investor_network_mobile_get_settings',
            'permission_callback' => 'investor_network_mobile_check_auth',
        ),
        array(
            'methods' => 'POST',
            'callback' => 'investor_network_mobile_update_settings',
            'permission_callback' => 'investor_network_mobile_check_auth',
        ),
    ) );

    // Polls
    register_rest_route( $namespace, '/polls', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_polls',
        'permission_callback' => '__return_true',
    ) );

    register_rest_route( $namespace, '/polls/(?P<id>\d+)/vote', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_submit_vote',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    // Announcements
    register_rest_route( $namespace, '/announcements', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_announcements',
        'permission_callback' => '__return_true',
    ) );

    // Member dashboard (protected)
    register_rest_route( $namespace, '/members/(?P<id>\d+)/dashboard', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_member_dashboard',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    // Convenience route for the authenticated current user. Some clients
    // expect `/members/me/dashboard`. Provide a thin wrapper that sets the
    // `id` parameter to the current user and reuses the same callback.
    register_rest_route( $namespace, '/members/me/dashboard', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_member_dashboard_me',
        'permission_callback' => 'investor_network_mobile_check_auth',
    ) );

    // Member profile routes
    register_rest_route( $namespace, '/members/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_member_profile',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    // Update member profile (protected)
    register_rest_route( $namespace, '/members/(?P<id>\d+)', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_update_member_profile',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    register_rest_route( $namespace, '/members/me', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_member_profile_me',
        'permission_callback' => 'investor_network_mobile_check_auth',
    ) );

    // Notifications - mobile-friendly REST wrappers using the same model as shortcode
    register_rest_route( $namespace, '/notifications', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_notifications',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'per_page' => array( 'default' => 50, 'sanitize_callback' => 'absint' ) ),
    ) );

    register_rest_route( $namespace, '/notifications/unread-count', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_unread_count',
        'permission_callback' => 'investor_network_mobile_check_auth',
    ) );

    register_rest_route( $namespace, '/notifications/summary', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_notifications_summary',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'per_page' => array( 'default' => 3, 'sanitize_callback' => 'absint' ) ),
    ) );

    register_rest_route( $namespace, '/notifications/(?P<id>\d+)/mark-read', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_mark_notification_read',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    register_rest_route( $namespace, '/notifications/mark-all-read', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_mark_all_notifications_read',
        'permission_callback' => 'investor_network_mobile_check_auth',
    ) );

    register_rest_route( $namespace, '/notifications/(?P<id>\d+)/delete', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_delete_notification',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    register_rest_route( $namespace, '/notifications/(?P<id>\d+)/archive', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_archive_notification',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    // Sell requests for a member (history)
    register_rest_route( $namespace, '/members/(?P<id>\d+)/sell-requests', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_sell_requests',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    // Note: debug routes removed — only production endpoints remain registered above.

    // Device Token for Push Notifications
    register_rest_route( $namespace, '/device-token', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_register_device_token',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array(
            'token' => array( 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
            'platform' => array( 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
        ),
    ) );

    // Avatar upload (REST) - accepts multipart/form-data 'avatar' file
    register_rest_route( $namespace, '/members/(?P<id>\d+)/avatar', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_upload_avatar_rest',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    // Change password (protected) - expects JSON: { current_password, new_password }
    register_rest_route( $namespace, '/members/(?P<id>\d+)/change-password', array(
        'methods' => 'POST',
        'callback' => 'investor_network_mobile_change_password',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    // Public profile (reduced fields)
    register_rest_route( $namespace, '/members/(?P<id>\d+)/public', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_member_profile_public',
        'permission_callback' => '__return_true',
        'args' => array( 'id' => array( 'sanitize_callback' => 'absint' ) ),
    ) );

    // Documents - expose member documents to mobile clients (requires auth)
    // Allow a permissive validate_callback for `per_page` to avoid WP treating
    // unexpected formats as invalid parameters. The handler will still sanitize
    // and bound the value server-side.
    register_rest_route( $namespace, '/documents', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_documents',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array(
            'per_page' => array(
                'default' => 100,
                'sanitize_callback' => 'absint',
                'validate_callback' => function( $param, $request, $key ) { return true; },
            ),
        ),
    ) );

    // Debug: return last debug.log tail and last PHP error for admins (protected)
    register_rest_route( $namespace, '/debug/documents-last-error', array(
        'methods' => 'GET',
        'callback' => 'investor_network_mobile_get_documents_last_error',
        'permission_callback' => 'investor_network_mobile_check_auth',
        'args' => array( 'lines' => array( 'default' => 200, 'sanitize_callback' => 'absint' ) ),
    ) );
}

// Authentication check
function investor_network_mobile_check_auth( WP_REST_Request $request ) {
    // Support JWT or Application Passwords
    if ( function_exists( 'jwt_auth_validate_token' ) ) {
        // JWT plugin is active
        $auth_header = $request->get_header( 'authorization' );
        if ( ! $auth_header || ! preg_match( '/Bearer\s+(.*)$/i', $auth_header, $matches ) ) {
            return new WP_Error( 'rest_forbidden', 'JWT token required', array( 'status' => 401 ) );
        }
        $token = $matches[1];
        $user = jwt_auth_validate_token( $token );
        if ( is_wp_error( $user ) ) {
            return $user;
        }
        wp_set_current_user( $user->ID );
        return true;
    } else {
        // Fallback to Application Passwords or basic auth
        if ( ! is_user_logged_in() ) {
            return new WP_Error( 'rest_forbidden', 'Authentication required', array( 'status' => 401 ) );
        }
        return true;
    }
}

// Route callbacks

function investor_network_mobile_get_listings( WP_REST_Request $request ) {
    // Adapt from existing AJAX handler or direct DB query
    global $wpdb;
    $page = $request->get_param( 'page' );
    $per_page = $request->get_param( 'per_page' );
    $status = $request->get_param( 'status' );

    $offset = ( $page - 1 ) * $per_page;

    $listings_table = $wpdb->prefix . 'investor_network_sell_listings';
    $proposals_table = $wpdb->prefix . 'investor_network_proposals';

    $query = $wpdb->prepare(
        "SELECT l.id, l.proposal_id, l.seller_user_id, l.quantity, l.price_per_share, p.title, p.description, p.investment_amount
         FROM {$listings_table} l
         LEFT JOIN {$proposals_table} p ON l.proposal_id = p.id
         WHERE l.quantity > 0
         ORDER BY l.created_at DESC
         LIMIT %d OFFSET %d",
        $per_page, $offset
    );

    $listings = $wpdb->get_results( $query );

    $data = array();
    foreach ( $listings as $listing ) {
        // Compute effective available quantity by subtracting completed purchases for this listing
        $purchases_table = $wpdb->prefix . 'investor_network_share_purchases';
        $sold_on_listing = intval( $wpdb->get_var( $wpdb->prepare( "SELECT SUM(share_quantity) FROM {$purchases_table} WHERE listing_id = %d AND status = %s", intval( $listing->id ), 'completed' ) ) );
        $effective_qty = isset( $listing->quantity ) ? max( 0, intval( $listing->quantity ) - $sold_on_listing ) : 0;

        // Exclude listings with no effective quantity or terminal statuses
        $status = isset( $listing->status ) ? strtolower( trim( $listing->status ) ) : '';
        if ( $effective_qty <= 0 ) continue;
        if ( in_array( $status, array( 'sold', 'closed', 'removed', 'declined' ), true ) ) continue;

        $unit_price = 0.0;
        if ( isset( $listing->price_per_share ) && floatval( $listing->price_per_share ) > 0 ) {
            $unit_price = floatval( $listing->price_per_share );
        } elseif ( isset( $listing->investment_amount ) && floatval( $listing->investment_amount ) > 0 ) {
            $unit_price = round( floatval( $listing->investment_amount ) / 1000, 2 );
        }
        $data[] = array(
            'id' => $listing->id,
            'proposal_id' => $listing->proposal_id,
            'title' => $listing->title,
            'description' => $listing->description,
            'quantity' => $effective_qty,
            'price_per_share' => $unit_price,
            'seller_user_id' => isset($listing->seller_user_id) ? intval($listing->seller_user_id) : null,
            'seller_display_name' => (isset($listing->seller_user_id) && intval($listing->seller_user_id) ? (get_userdata(intval($listing->seller_user_id)) ? get_userdata(intval($listing->seller_user_id))->display_name : '') : ''),
            'seller_avatar_url' => (isset($listing->seller_user_id) && intval($listing->seller_user_id) ? get_avatar_url(intval($listing->seller_user_id)) : ''),
            'currency' => get_option('investor_network_currency', 'USD'),
            'sell_request_id' => isset($listing->sell_request_id) ? intval($listing->sell_request_id) : null,
            'investment_amount' => isset($listing->investment_amount) ? $listing->investment_amount : null,
        );
    }

    return new WP_REST_Response( $data, 200 );
}

function investor_network_mobile_get_listing( WP_REST_Request $request ) {
    $id = $request->get_param( 'id' );
    global $wpdb;
    $listings_table = $wpdb->prefix . 'investor_network_sell_listings';
    $proposals_table = $wpdb->prefix . 'investor_network_proposals';

    $listing = $wpdb->get_row( $wpdb->prepare(
        "SELECT l.*, p.title, p.description, p.investment_amount
         FROM {$listings_table} l
         LEFT JOIN {$proposals_table} p ON l.proposal_id = p.id
         WHERE l.id = %d",
        $id
    ) );

    if ( ! $listing ) {
        return new WP_Error( 'not_found', 'Listing not found', array( 'status' => 404 ) );
    }

    $unit_price = 0.0;
    if ( isset( $listing->price_per_share ) && floatval( $listing->price_per_share ) > 0 ) {
        $unit_price = floatval( $listing->price_per_share );
    } elseif ( isset( $listing->investment_amount ) && floatval( $listing->investment_amount ) > 0 ) {
        $unit_price = round( floatval( $listing->investment_amount ) / 1000, 2 );
    }

    return new WP_REST_Response( array(
        'id' => $listing->id,
        'proposal_id' => $listing->proposal_id,
        'title' => $listing->title,
        'description' => $listing->description,
        'quantity' => $listing->quantity,
        'price_per_share' => $unit_price,
        'seller_user_id' => isset($listing->seller_user_id) ? intval($listing->seller_user_id) : null,
        'seller_display_name' => (isset($listing->seller_user_id) && intval($listing->seller_user_id) ? (get_userdata(intval($listing->seller_user_id)) ? get_userdata(intval($listing->seller_user_id))->display_name : '') : ''),
        'seller_avatar_url' => (isset($listing->seller_user_id) && intval($listing->seller_user_id) ? get_avatar_url(intval($listing->seller_user_id)) : ''),
        'currency' => get_option('investor_network_currency', 'USD'),
        'sell_request_id' => isset($listing->sell_request_id) ? intval($listing->sell_request_id) : null,
        'investment_amount' => $listing->investment_amount,
    ), 200 );
}

/**
 * Return normalized secondary listings / sell_request items for a proposal.
 * This provides a stable shape for the mobile client (unit_price, available_quantity, seller info).
 */
function investor_network_mobile_get_proposal_secondary_listings( WP_REST_Request $request ) {
    $proposal_id = intval( $request->get_param( 'id' ) );
    if ( $proposal_id <= 0 ) {
        return new WP_Error( 'invalid', 'Invalid proposal id', array( 'status' => 400 ) );
    }

    global $wpdb;
    $listings_table = $wpdb->prefix . 'investor_network_sell_listings';
    $requests_table = $wpdb->prefix . 'investor_network_sell_requests';
    $proposals_table = $wpdb->prefix . 'investor_network_proposals';

    $out = array();

    // 1) Query explicit sell_listings for this proposal
    // Match web behavior: require positive quantity, exclude terminal statuses, and ensure linked sell_request is approved
    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT l.*, p.title as proposal_title, p.investment_amount, sr.status AS sell_request_status FROM {$listings_table} l LEFT JOIN {$proposals_table} p ON l.proposal_id = p.id LEFT JOIN {$requests_table} sr ON l.sell_request_id = sr.id WHERE l.proposal_id = %d AND l.quantity > 0 AND (l.status IS NULL OR l.status NOT IN ('sold','closed','removed','declined')) AND (l.sell_request_id IS NULL OR sr.status = 'approved') ORDER BY l.created_at DESC",
        $proposal_id
    ), ARRAY_A );

    if ( $rows ) {
            foreach ( $rows as $r ) {
                $seller_id = isset( $r['seller_user_id'] ) ? intval( $r['seller_user_id'] ) : 0;
                $unit_price = isset( $r['price_per_share'] ) ? floatval( $r['price_per_share'] ) : 0.0;
                $orig_qty = isset( $r['quantity'] ) ? intval( $r['quantity'] ) : 0;

                // If this listing references a sell_request and that sell_request contains
                // item-level information for this proposal, prefer the item-level
                // quantity (mirrors web shortcode behavior).
                if ( ! empty( $r['sell_request_id'] ) ) {
                    $requests_table = $wpdb->prefix . 'investor_network_sell_requests';
                    $sr_row = $wpdb->get_row( $wpdb->prepare( "SELECT items_json FROM {$requests_table} WHERE id = %d AND status = %s", intval( $r['sell_request_id'] ), 'approved' ), ARRAY_A );
                    if ( $sr_row && ! empty( $sr_row['items_json'] ) ) {
                        $items_for_sr = json_decode( $sr_row['items_json'], true );
                        if ( is_array( $items_for_sr ) ) {
                            foreach ( $items_for_sr as $it ) {
                                $pid = isset( $it['id'] ) ? intval( $it['id'] ) : 0;
                                if ( $pid === intval( $r['proposal_id'] ) ) {
                                    $item_qty = isset( $it['quantity'] ) ? intval( $it['quantity'] ) : 0;
                                        // Only prefer the sell_request item-level quantity when the
                                        // explicit listing row does not itself have a positive
                                        // quantity. This prevents items_json from inflating the
                                        // available quantity when a concrete listing row exists.
                                        if ( $item_qty > 0 && $orig_qty <= 0 ) {
                                            $orig_qty = $item_qty;
                                        }
                                    break;
                                }
                            }
                        }
                    }
                }

                // Compute completed purchases for this listing and derive effective available quantity
                $purchases_table = $wpdb->prefix . 'investor_network_share_purchases';
                $sold_on_listing = intval( $wpdb->get_var( $wpdb->prepare( "SELECT SUM(share_quantity) FROM {$purchases_table} WHERE listing_id = %d AND status = %s", intval( $r['id'] ), 'completed' ) ) );
                $avail = max( 0, $orig_qty - $sold_on_listing );

                // Safety: never report more available than the listing's stored
                // `quantity` column if present. This keeps the mobile API aligned
                // with the canonical listing row that the web UI displays.
                if ( isset( $r['quantity'] ) && intval( $r['quantity'] ) > 0 ) {
                    $avail = min( $avail, intval( $r['quantity'] ) );
                }

                // Skip listings that are no longer available
                if ( $avail <= 0 ) continue;

                // If this listing references a sell_request, prefer any item-level price from that sell_request
                if ( ( $unit_price <= 0 ) && ! empty( $r['sell_request_id'] ) ) {
                    $sr = $wpdb->get_row( $wpdb->prepare( "SELECT items_json FROM {$requests_table} WHERE id = %d AND status = %s", intval( $r['sell_request_id'] ), 'approved' ), ARRAY_A );
                    if ( $sr && ! empty( $sr['items_json'] ) ) {
                        $items = json_decode( $sr['items_json'], true );
                        if ( is_array( $items ) ) {
                            foreach ( $items as $it ) {
                                $pid = isset( $it['id'] ) ? intval( $it['id'] ) : 0;
                                $price = isset( $it['price'] ) ? floatval( $it['price'] ) : 0.0;
                                if ( $pid === intval( $r['proposal_id'] ) && $price > 0 ) {
                                    $unit_price = $price;
                                    break;
                                }
                            }
                        }
                    }
                }

                $out[] = array(
                    'id' => isset( $r['id'] ) ? intval( $r['id'] ) : 0,
                    'proposal_id' => intval( $r['proposal_id'] ),
                    'proposal_title' => isset( $r['proposal_title'] ) ? $r['proposal_title'] : '',
                    'seller_user_id' => $seller_id,
                    'available_quantity' => $avail,
                    'unit_price' => $unit_price,
                    'seller_display_name' => $seller_id ? ( get_userdata( $seller_id ) ? get_userdata( $seller_id )->display_name : '' ) : '',
                    'seller_avatar_url' => $seller_id ? get_avatar_url( $seller_id ) : '',
                    'currency' => get_option( 'investor_network_currency', 'USD' ),
                    'raw' => $r,
                );
            }
    }

    // 2) Include approved sell_requests items for this proposal (if any)
    $reqs = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$requests_table} WHERE proposal_id = %d AND status = %s", $proposal_id, 'approved' ), ARRAY_A );
    if ( $reqs ) {
        foreach ( $reqs as $req ) {
            $items = array();
            if ( ! empty( $req['items_json'] ) ) {
                $items = json_decode( $req['items_json'], true );
                if ( ! is_array( $items ) ) $items = array();
            }

                if ( empty( $items ) ) {
                // single-item sell_request fallback
                $seller_id = isset( $req['user_id'] ) ? intval( $req['user_id'] ) : 0;
                $unit_price = isset( $req['price'] ) ? floatval( $req['price'] ) : 0.0;
                $avail = isset( $req['quantity'] ) ? intval( $req['quantity'] ) : 0;
                    if ( $avail <= 0 ) continue;
                $out[] = array(
                    'id' => isset( $req['id'] ) ? intval( $req['id'] ) : 0,
                    'proposal_id' => intval( $req['proposal_id'] ),
                    'proposal_title' => '',
                    'seller_user_id' => $seller_id,
                    'available_quantity' => $avail,
                    'unit_price' => $unit_price,
                    'seller_display_name' => $seller_id ? ( get_userdata( $seller_id ) ? get_userdata( $seller_id )->display_name : '' ) : '',
                    'seller_avatar_url' => $seller_id ? get_avatar_url( $seller_id ) : '',
                    'currency' => get_option( 'investor_network_currency', 'USD' ),
                    'raw' => $req,
                    'sell_request_id' => isset( $req['id'] ) ? intval( $req['id'] ) : null,
                );
                } else {
                    foreach ( $items as $it ) {
                        $item_pid = isset( $it['id'] ) ? intval( $it['id'] ) : intval( $req['proposal_id'] );
                        if ( $item_pid !== $proposal_id ) continue;
                        $seller_id = isset( $req['user_id'] ) ? intval( $req['user_id'] ) : 0;
                        $unit_price = isset( $it['price'] ) ? floatval( $it['price'] ) : 0.0;
                        $avail = isset( $it['quantity'] ) ? intval( $it['quantity'] ) : ( isset( $req['quantity'] ) ? intval( $req['quantity'] ) : 0 );
                        if ( $avail <= 0 ) continue;
                        $out[] = array(
                            'id' => isset( $req['id'] ) ? intval( $req['id'] ) : 0,
                            'proposal_id' => $item_pid,
                            'proposal_title' => '',
                            'seller_user_id' => $seller_id,
                            'available_quantity' => $avail,
                            'unit_price' => $unit_price,
                            'seller_display_name' => $seller_id ? ( get_userdata( $seller_id ) ? get_userdata( $seller_id )->display_name : '' ) : '',
                            'seller_avatar_url' => $seller_id ? get_avatar_url( $seller_id ) : '',
                            'currency' => get_option( 'investor_network_currency', 'USD' ),
                            'raw' => $req,
                            'sell_request_id' => isset( $req['id'] ) ? intval( $req['id'] ) : null,
                        );
                    }
                }
        }
    }

    return new WP_REST_Response( array( 'value' => $out, 'Count' => count( $out ) ), 200 );
}

// Sell requests for a member (history)
// (registration moved into investor_network_mobile_register_routes to use $namespace)

function investor_network_mobile_get_sell_requests( WP_REST_Request $request ) {
    $id = intval( $request->get_param( 'id' ) );
    $current = get_current_user_id();
    if ( $current !== $id && ! current_user_can( 'manage_options' ) ) {
        return new WP_Error( 'forbidden', 'Not authorized to view this data', array( 'status' => 403 ) );
    }

    global $wpdb;
    $sr_table = $wpdb->prefix . 'investor_network_sell_requests';

    // Some installs may not have the `total_amount` column. Detect and adapt the SELECT list.
    $col_total = $wpdb->get_var( $wpdb->prepare( "SHOW COLUMNS FROM {$sr_table} LIKE %s", 'total_amount' ) );
    $select_fields = 'id, user_id, quantity, items_json, status, created_at, updated_at';
    if ( $col_total ) {
        $select_fields = 'id, user_id, quantity, items_json, status, total_amount, created_at, updated_at';
    }

    $query = $wpdb->prepare( "SELECT {$select_fields} FROM {$sr_table} WHERE user_id = %d ORDER BY created_at DESC LIMIT 50", $id );
    $rows = $wpdb->get_results( $query, ARRAY_A );

    $out = array();
    if ( $rows ) {
        foreach ( $rows as $r ) {
            $out[] = array(
                'id' => intval( $r['id'] ),
                'user_id' => intval( $r['user_id'] ),
                'quantity' => intval( $r['quantity'] ),
                'items' => json_decode( $r['items_json'], true ) ?: array(),
                'status' => $r['status'],
                'total_amount' => $col_total && isset( $r['total_amount'] ) ? floatval( $r['total_amount'] ) : 0.0,
                'created_at' => $r['created_at'],
                'updated_at' => $r['updated_at'],
            );
        }
    }

    return new WP_REST_Response( array( 'sell_requests' => $out ), 200 );
}

/**
 * Return notifications for the current user using the canonical Notifications model.
 */
function investor_network_mobile_get_notifications( WP_REST_Request $request ) {
    if ( ! function_exists( 'get_current_user_id' ) ) return new WP_Error( 'server_error', 'Auth helpers missing', array( 'status' => 500 ) );
    $user_id = get_current_user_id();
    if ( ! $user_id ) return new WP_Error( 'forbidden', 'Authentication required', array( 'status' => 401 ) );

    // Ensure the model class is available; try to load from main plugin if necessary
    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) {
        $maybe = '';
        if ( defined( 'INVESTOR_NETWORK_PLUGIN_DIR' ) ) {
            $maybe = rtrim( INVESTOR_NETWORK_PLUGIN_DIR, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'class-investor-network-model-notifications.php';
        } else {
            $maybe = dirname( dirname( __FILE__ ) ) . DIRECTORY_SEPARATOR . 'investor-network' . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'class-investor-network-model-notifications.php';
        }
        if ( $maybe && file_exists( $maybe ) ) {
            require_once $maybe;
        }
    }

    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) {
        return new WP_Error( 'not_available', 'Notifications model not available', array( 'status' => 500 ) );
    }

    $per_page = $request->get_param( 'per_page' ) ? intval( $request->get_param( 'per_page' ) ) : 50;
    $model = new Investor_Network_Model_Notifications();
    $rows = $model->get_by_user( $user_id, $per_page );

    $out = array();
    if ( $rows ) {
        foreach ( $rows as $r ) {
            $out[] = array(
                'id' => intval( $r->id ),
                'type' => $r->type,
                'title' => $r->title,
                'message' => $r->message,
                'is_read' => boolval( $r->is_read ),
                'action_url' => isset( $r->action_url ) ? $r->action_url : null,
                'related_object_type' => isset( $r->related_object_type ) ? $r->related_object_type : null,
                'related_object_id' => isset( $r->related_object_id ) ? intval( $r->related_object_id ) : null,
                'created_at' => isset( $r->created_at ) ? $r->created_at : null,
            );
        }
    }

    return new WP_REST_Response( array( 'notifications' => $out ), 200 );
}

function investor_network_mobile_mark_notification_read( WP_REST_Request $request ) {
    $id = intval( $request->get_param( 'id' ) );
    if ( ! $id ) return new WP_Error( 'invalid', 'Invalid id', array( 'status' => 400 ) );
    $user_id = get_current_user_id();
    if ( ! $user_id ) return new WP_Error( 'forbidden', 'Authentication required', array( 'status' => 401 ) );

    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) {
        $maybe = rtrim( INVESTOR_NETWORK_PLUGIN_DIR, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'class-investor-network-model-notifications.php';
        if ( file_exists( $maybe ) ) require_once $maybe;
    }
    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) return new WP_Error( 'not_available', 'Notifications model not available', array( 'status' => 500 ) );

    $model = new Investor_Network_Model_Notifications();
    // Ensure the notification belongs to the user
    $rows = $model->get_by_user( $user_id, 200 );
    $ids = wp_list_pluck( $rows, 'id' );
    if ( ! in_array( $id, $ids ) ) return new WP_Error( 'forbidden', 'Not authorized to modify this notification', array( 'status' => 403 ) );

    $ok = $model->mark_read( $id );
    if ( $ok ) return new WP_REST_Response( array( 'success' => true ), 200 );
    return new WP_Error( 'db', 'Failed to mark read', array( 'status' => 500 ) );
}

function investor_network_mobile_mark_all_notifications_read( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( ! $user_id ) return new WP_Error( 'forbidden', 'Authentication required', array( 'status' => 401 ) );
    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) {
        $maybe = rtrim( INVESTOR_NETWORK_PLUGIN_DIR, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'class-investor-network-model-notifications.php';
        if ( file_exists( $maybe ) ) require_once $maybe;
    }
    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) return new WP_Error( 'not_available', 'Notifications model not available', array( 'status' => 500 ) );
    $model = new Investor_Network_Model_Notifications();
    $ok = $model->mark_all_read( $user_id );
    if ( $ok ) return new WP_REST_Response( array( 'success' => true ), 200 );
    return new WP_Error( 'db', 'Failed to mark all read', array( 'status' => 500 ) );
}

function investor_network_mobile_delete_notification( WP_REST_Request $request ) {
    $id = intval( $request->get_param( 'id' ) );
    if ( ! $id ) return new WP_Error( 'invalid', 'Invalid id', array( 'status' => 400 ) );
    $user_id = get_current_user_id();
    if ( ! $user_id ) return new WP_Error( 'forbidden', 'Authentication required', array( 'status' => 401 ) );
    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) {
        $maybe = rtrim( INVESTOR_NETWORK_PLUGIN_DIR, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'class-investor-network-model-notifications.php';
        if ( file_exists( $maybe ) ) require_once $maybe;
    }
    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) return new WP_Error( 'not_available', 'Notifications model not available', array( 'status' => 500 ) );
    $model = new Investor_Network_Model_Notifications();
    // verify ownership
    $rows = $model->get_by_user( $user_id, 200 );
    $ids = wp_list_pluck( $rows, 'id' );
    if ( ! in_array( $id, $ids ) ) return new WP_Error( 'forbidden', 'Not authorized to delete this notification', array( 'status' => 403 ) );
    $ok = $model->delete( $id );
    if ( $ok ) return new WP_REST_Response( array( 'success' => true ), 200 );
    return new WP_Error( 'db', 'Failed to delete notification', array( 'status' => 500 ) );
}

function investor_network_mobile_archive_notification( WP_REST_Request $request ) {
    $id = intval( $request->get_param( 'id' ) );
    if ( ! $id ) return new WP_Error( 'invalid', 'Invalid id', array( 'status' => 400 ) );
    $user_id = get_current_user_id();
    if ( ! $user_id ) return new WP_Error( 'forbidden', 'Authentication required', array( 'status' => 401 ) );

    // Ensure model available
    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) {
        $maybe = rtrim( INVESTOR_NETWORK_PLUGIN_DIR, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'class-investor-network-model-notifications.php';
        if ( file_exists( $maybe ) ) require_once $maybe;
    }
    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) return new WP_Error( 'not_available', 'Notifications model not available', array( 'status' => 500 ) );

    $model = new Investor_Network_Model_Notifications();
    $rows = $model->get_by_user( $user_id, 200 );
    $ids = wp_list_pluck( $rows, 'id' );
    if ( ! in_array( $id, $ids ) ) return new WP_Error( 'forbidden', 'Not authorized to archive this notification', array( 'status' => 403 ) );

    global $wpdb;
    $table = $wpdb->prefix . 'investor_network_notifications';

    // Mark as read and set expires_at to now so it will no longer appear in lists
    $now = current_time( 'mysql' );
    $ok = $wpdb->update( $table, array( 'is_read' => 1, 'expires_at' => $now ), array( 'id' => $id ), array( '%d', '%s' ), array( '%d' ) );

    if ( $ok === false ) return new WP_Error( 'db', 'Failed to archive notification', array( 'status' => 500 ) );

    return new WP_REST_Response( array( 'success' => true ), 200 );
}

function investor_network_mobile_get_unread_count( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( ! $user_id ) return new WP_Error( 'forbidden', 'Authentication required', array( 'status' => 401 ) );

    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) {
        $maybe = rtrim( INVESTOR_NETWORK_PLUGIN_DIR, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'class-investor-network-model-notifications.php';
        if ( file_exists( $maybe ) ) require_once $maybe;
    }
    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) return new WP_Error( 'not_available', 'Notifications model not available', array( 'status' => 500 ) );
    $model = new Investor_Network_Model_Notifications();
    $count = intval( $model->count_unread( $user_id ) );
    return new WP_REST_Response( array( 'unread' => $count ), 200 );
}

function investor_network_mobile_get_documents( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( ! $user_id ) return new WP_Error( 'forbidden', 'Authentication required', array( 'status' => 401 ) );

    // Debug: log incoming request params to help diagnose invalid-parameter errors (remove after debugging)
    try {
        error_log( 'Mobile API /documents params: ' . json_encode( $request->get_params() ) );
    } catch ( \Throwable $e ) {
        // ignore logging failures
    }
    // Try to load the documents model used by the shortcode
    $model_paths = array();
    if ( defined( 'INVESTOR_NETWORK_PLUGIN_DIR' ) ) {
        $model_paths[] = INVESTOR_NETWORK_PLUGIN_DIR . 'includes/models/class-investor-network-model-documents.php';
        $model_paths[] = INVESTOR_NETWORK_PLUGIN_DIR . 'includes/db/class-investor-network-model-documents.php';
        $model_paths[] = INVESTOR_NETWORK_PLUGIN_DIR . 'includes/class-investor-network-model-documents.php';
    }
    // Fallback local path
    $model_paths[] = dirname( __FILE__ ) . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'class-investor-network-model-documents.php';

    $loaded = false;
    // Log candidate paths for debugging (local dev only)
    try {
        error_log( 'Mobile API /documents: candidate model_paths: ' . json_encode( $model_paths ) );
    } catch ( Throwable $e ) {
        // ignore logging failures
    }

    foreach ( $model_paths as $mp ) {
        // If the class is already available, stop attempting to load files.
        if ( class_exists( 'Investor_Network_Model_Documents' ) ) {
            $loaded = true;
            break;
        }

        try {
            error_log( 'Mobile API /documents: checking path: ' . $mp . ' exists=' . ( $mp && file_exists( $mp ) ? 'YES' : 'NO' ) );
        } catch ( Throwable $e ) {
            // ignore logging failures
        }

        if ( $mp && file_exists( $mp ) ) {
            // Only require if the class is still not defined to avoid duplicate declarations.
            if ( ! class_exists( 'Investor_Network_Model_Documents' ) ) {
                require_once $mp;
            }

            try {
                error_log( 'Mobile API /documents: class_exists after require? ' . ( class_exists( 'Investor_Network_Model_Documents' ) ? 'YES' : 'NO' ) );
            } catch ( Throwable $e ) {
                // ignore logging failures
            }

            if ( class_exists( 'Investor_Network_Model_Documents' ) ) {
                $loaded = true;
                break;
            }
        }
    }

    if ( ! class_exists( 'Investor_Network_Model_Documents' ) ) {
        // For local debugging, include which paths were checked and whether they exist.
        $checked = array();
        foreach ( $model_paths as $mp ) {
            $checked[ $mp ] = $mp && file_exists( $mp );
        }
        $data = array( 'status' => 500, 'checked_paths' => $checked, 'class_loaded' => false );
        return new WP_Error( 'not_available', 'Documents model not available', $data );
    }

    $model = new Investor_Network_Model_Documents();
    $per_page = $request->get_param( 'per_page' ) ? intval( $request->get_param( 'per_page' ) ) : 100;

    $docs = $model->get_for_member( $user_id, null );
    if ( ! is_array( $docs ) ) $docs = array();

    $out = array();
    foreach ( array_slice( $docs, 0, $per_page ) as $d ) {
        $out[] = array(
            'id' => isset( $d->id ) ? intval( $d->id ) : 0,
            'title' => isset( $d->title ) ? $d->title : '',
            'description' => isset( $d->description ) ? $d->description : '',
            'file_url' => isset( $d->file_url ) ? $d->file_url : '',
            'file_name' => isset( $d->file_name ) ? $d->file_name : ( isset( $d->file_url ) ? basename( $d->file_url ) : '' ),
            'file_size' => isset( $d->file_size ) ? $d->file_size : 0,
            'category' => isset( $d->category ) ? $d->category : '',
            'visibility' => isset( $d->visibility ) ? $d->visibility : '',
            'created_at' => isset( $d->created_at ) ? $d->created_at : null,
            'is_favorited' => isset( $d->is_favorited ) ? boolval( $d->is_favorited ) : false,
        );
    }

    return new WP_REST_Response( array( 'documents' => $out, 'count' => count( $out ) ), 200 );
}

function investor_network_mobile_get_documents_last_error( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( ! $user_id ) return new WP_Error( 'forbidden', 'Authentication required', array( 'status' => 401 ) );
    // For local development, allow non-admins to fetch debug info when WP_DEBUG is enabled.
    if ( ! current_user_can( 'manage_options' ) ) {
        if ( ! ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ) {
            return new WP_Error( 'forbidden', 'Admin capability required', array( 'status' => 403 ) );
        }
    }

    $lines = intval( $request->get_param( 'lines' ) );
    if ( $lines <= 0 ) $lines = 200;

    // Locate debug log
    $candidates = array();
    if ( defined( 'WP_CONTENT_DIR' ) ) $candidates[] = rtrim( WP_CONTENT_DIR, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR . 'debug.log';
    $candidates[] = ABSPATH . 'wp-content' . DIRECTORY_SEPARATOR . 'debug.log';
    $candidates[] = dirname( dirname( __FILE__ ) ) . DIRECTORY_SEPARATOR . 'wp-content' . DIRECTORY_SEPARATOR . 'debug.log';

    $log_path = null;
    foreach ( $candidates as $c ) {
        if ( $c && file_exists( $c ) ) { $log_path = $c; break; }
    }

    $tail = '';
    if ( $log_path ) {
        // Read last N lines safely
        $content = @file( $log_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES );
        if ( is_array( $content ) ) {
            $total = count( $content );
            $start = max( 0, $total - $lines );
            $tail_lines = array_slice( $content, $start );
            $tail = implode( "\n", $tail_lines );
        }
    }

    $last_err = error_get_last();

    return new WP_REST_Response( array( 'log_path' => $log_path, 'tail' => $tail, 'last_error' => $last_err ), 200 );
}

function investor_network_mobile_get_notifications_summary( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( ! $user_id ) return new WP_Error( 'forbidden', 'Authentication required', array( 'status' => 401 ) );

    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) {
        $maybe = rtrim( INVESTOR_NETWORK_PLUGIN_DIR, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'class-investor-network-model-notifications.php';
        if ( file_exists( $maybe ) ) require_once $maybe;
    }
    if ( ! class_exists( 'Investor_Network_Model_Notifications' ) ) return new WP_Error( 'not_available', 'Notifications model not available', array( 'status' => 500 ) );

    $per_page = $request->get_param( 'per_page' ) ? intval( $request->get_param( 'per_page' ) ) : 3;
    $model = new Investor_Network_Model_Notifications();
    $unread = intval( $model->count_unread( $user_id ) );

    // Fetch recent notifications (most recent first)
    $rows = $model->get_by_user( $user_id, $per_page );
    $recent = array();
    if ( $rows ) {
        foreach ( $rows as $r ) {
            $recent[] = array(
                'id' => intval( $r->id ),
                'title' => $r->title,
                'message' => $r->message,
                'is_read' => boolval( $r->is_read ),
                'action_url' => isset( $r->action_url ) ? $r->action_url : null,
                'created_at' => isset( $r->created_at ) ? $r->created_at : null,
            );
        }
    }

    return new WP_REST_Response( array( 'unread' => $unread, 'recent' => $recent ), 200 );
}

/**
 * Return raw sell_request rows for a member including decoded items_json.
 * This avoids selecting non-existent columns on installs with differing schema.
 */
// (Removed) investor_network_mobile_get_sell_requests_raw: debug helper removed.

// (Removed) investor_network_mobile_get_sell_request: debug helper removed.

// (Removed) investor_network_mobile_debug_all_sell_requests: debug helper removed.

// (Removed) investor_network_mobile_debug_sell_listings: debug helper removed.

function investor_network_mobile_get_availability( WP_REST_Request $request ) {
    $id = $request->get_param( 'id' );
    // Use existing get_share_availability AJAX handler logic
    // For simplicity, query DB directly
    global $wpdb;
    $purchases_table = $wpdb->prefix . 'investor_network_share_purchases';
    $proposals_table = $wpdb->prefix . 'investor_network_proposals';

    $proposal = $wpdb->get_row( $wpdb->prepare( "SELECT investment_amount FROM {$proposals_table} WHERE id = %d", $id ) );
    if ( ! $proposal ) {
        return new WP_Error( 'not_found', 'Proposal not found', array( 'status' => 404 ) );
    }

    $total_shares = 1000; // Assume fixed or calculate
    $sold = $wpdb->get_var( $wpdb->prepare(
        "SELECT SUM(share_quantity) FROM {$purchases_table} WHERE proposal_id = %d AND status IN ('completed', 'pending')",
        $id
    ) );
    $available = max(0, $total_shares - $sold);

    return new WP_REST_Response( array(
        'total_shares' => $total_shares,
        'sold_shares' => $sold,
        'available_shares' => $available,
        'share_price' => $proposal->investment_amount / $total_shares,
    ), 200 );
}

function investor_network_mobile_purchase_listing( WP_REST_Request $request ) {
    try {
        $id = $request->get_param( 'id' );
        $quantity = $request->get_param( 'quantity' );
        $payment_method = $request->get_param( 'payment_method' );
        $payment_payload = $request->get_param( 'payment_payload' );

        // If the client provided an explicit unit_price in the payment payload, prefer it.
        $provided_unit_price = 0.0;
        if ( is_array( $payment_payload ) && isset( $payment_payload['unit_price'] ) ) {
            $provided_unit_price = floatval( $payment_payload['unit_price'] );
        } elseif ( is_string( $payment_payload ) ) {
            // Sometimes client may send a scalar or JSON string — attempt to decode
            $maybe = json_decode( $payment_payload, true );
            if ( is_array( $maybe ) && isset( $maybe['unit_price'] ) ) {
                $provided_unit_price = floatval( $maybe['unit_price'] );
            }
        }

        // Adapt from existing purchase_listing_shares AJAX handler
        // For now, insert into purchases table
        global $wpdb;
        $user_id = get_current_user_id();
        $purchases_table = $wpdb->prefix . 'investor_network_share_purchases';

        $listing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}investor_network_sell_listings WHERE id = %d", $id ) );

        // If listing is not found, attempt to treat the provided id as a sell_request id
        // (this mirrors the web site's behavior where an approved sell_request may be
        // shown as a fallback and the web flow creates a listing on-demand).
        if ( ! $listing ) {
            $requests_table = $wpdb->prefix . 'investor_network_sell_requests';
            $maybe_req = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$requests_table} WHERE id = %d AND status = %s AND (quantity > 0 OR items_json IS NOT NULL)", $id, 'approved' ) );
            if ( $maybe_req ) {
                $items = array();
                if ( ! empty( $maybe_req->items_json ) ) {
                    $items = json_decode( $maybe_req->items_json, true );
                }
                if ( ! is_array( $items ) ) $items = array();

                $chosen_item = null;
                if ( ! empty( $items ) ) {
                    $chosen_item = $items[0];
                }

                if ( $chosen_item ) {
                    $chosen_proposal_id = isset( $chosen_item['id'] ) ? intval( $chosen_item['id'] ) : ( isset( $maybe_req->proposal_id ) ? intval( $maybe_req->proposal_id ) : 0 );
                    $chosen_quantity = isset( $chosen_item['quantity'] ) ? intval( $chosen_item['quantity'] ) : ( isset( $maybe_req->quantity ) ? intval( $maybe_req->quantity ) : 0 );
                    $chosen_price = null;
                    if ( isset( $chosen_item['price'] ) && $chosen_item['price'] !== '' ) {
                        $chosen_price = floatval( $chosen_item['price'] );
                    } elseif ( isset( $maybe_req->price ) && $maybe_req->price !== '' ) {
                        $chosen_price = floatval( $maybe_req->price );
                    }

                    if ( $chosen_quantity > 0 ) {
                        $listings_table = $wpdb->prefix . 'investor_network_sell_listings';
                        $inserted = $wpdb->insert(
                            $listings_table,
                            array(
                                'seller_user_id' => intval( $maybe_req->user_id ),
                                'proposal_id' => $chosen_proposal_id,
                                'price_per_share' => $chosen_price !== null ? $chosen_price : 0,
                                'quantity' => $chosen_quantity,
                                'status' => 'listed',
                                'created_at' => current_time('mysql'),
                                'sell_request_id' => intval( $maybe_req->id )
                            ),
                            array('%d','%d','%f','%d','%s','%s','%d')
                        );

                        if ( $inserted !== false ) {
                            $new_listing_id = intval( $wpdb->insert_id );
                            $listing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}investor_network_sell_listings WHERE id = %d", $new_listing_id ) );
                            $id = $new_listing_id; // ensure subsequent code tracks the real listing id
                        }
                    }
                }
            }

            if ( ! $listing ) {
                return new WP_Error( 'not_found', 'Listing not found', array( 'status' => 404 ) );
            }
        }

        // If this listing references a sell_request, prefer any item-level price from the
        // sell_request items_json for the listing's proposal (mirrors get_listing_details()).
        if ( isset( $listing->sell_request_id ) && ! empty( $listing->sell_request_id ) ) {
            $requests_table = $wpdb->prefix . 'investor_network_sell_requests';
            $sell_request = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$requests_table} WHERE id = %d AND status = 'approved'", $listing->sell_request_id ) );
            if ( $sell_request && ! empty( $sell_request->items_json ) ) {
                $items = json_decode( $sell_request->items_json, true );
                if ( is_array( $items ) ) {
                    foreach ( $items as $item ) {
                        $pid = isset( $item['id'] ) ? intval( $item['id'] ) : 0;
                        $price = isset( $item['price'] ) ? floatval( $item['price'] ) : 0;
                        if ( $pid === intval( $listing->proposal_id ) && $price > 0 ) {
                            $listing->price_per_share = $price;
                            break;
                        }
                    }
                }
            }
        }

        // Determine unit price:
        // 1) prefer listing.price_per_share when present (>0)
        // 2) else prefer any sell_request item price for this proposal (search other listings/sell_requests)
        // 3) else fall back to proposal.investment_amount / 1000
        $unit_price = 0.0;
        // If client explicitly sent a unit_price (for example when buying directly from a proposal), honor it.
        if ( $provided_unit_price > 0 ) {
            $unit_price = $provided_unit_price;
        } else {
        if ( isset( $listing->price_per_share ) && floatval( $listing->price_per_share ) > 0 ) {
            $unit_price = floatval( $listing->price_per_share );
        } else {
            // Search other listings for this proposal to find any sell_request item-level price
            $best_price = 0.0;
            $listings_table = $wpdb->prefix . 'investor_network_sell_listings';
            if ( isset( $listing->proposal_id ) && intval( $listing->proposal_id ) ) {
                $other_listings = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$listings_table} WHERE proposal_id = %d AND id != %d", intval( $listing->proposal_id ), isset( $listing->id ) ? intval( $listing->id ) : 0 ), ARRAY_A );
                if ( $other_listings ) {
                    foreach ( $other_listings as $ol ) {
                        // prefer explicit listing price if present
                        if ( isset( $ol['price_per_share'] ) && floatval( $ol['price_per_share'] ) > 0 ) {
                            $best_price = max( $best_price, floatval( $ol['price_per_share'] ) );
                        }

                        // if the other listing references a sell_request, check its items_json for a matching item price
                        if ( ! empty( $ol['sell_request_id'] ) ) {
                            $requests_table = $wpdb->prefix . 'investor_network_sell_requests';
                            $sr = $wpdb->get_row( $wpdb->prepare( "SELECT items_json, status FROM {$requests_table} WHERE id = %d AND status = %s", intval( $ol['sell_request_id'] ), 'approved' ), ARRAY_A );
                            if ( $sr && ! empty( $sr['items_json'] ) ) {
                                $items = json_decode( $sr['items_json'], true );
                                if ( is_array( $items ) ) {
                                    foreach ( $items as $item ) {
                                        $pid = isset( $item['id'] ) ? intval( $item['id'] ) : 0;
                                        $price = isset( $item['price'] ) ? floatval( $item['price'] ) : 0;
                                        if ( $pid === intval( $listing->proposal_id ) && $price > 0 ) {
                                            $best_price = max( $best_price, $price );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if ( $best_price > 0 ) {
                $unit_price = $best_price;
            } else {
                // fallback to proposal investment_amount
                $proposals_table = $wpdb->prefix . 'investor_network_proposals';
                $proposal = $wpdb->get_row( $wpdb->prepare( "SELECT investment_amount FROM {$proposals_table} WHERE id = %d", isset( $listing->proposal_id ) ? intval( $listing->proposal_id ) : 0 ) );
                if ( $proposal && isset( $proposal->investment_amount ) && floatval( $proposal->investment_amount ) > 0 ) {
                    $unit_price = round( floatval( $proposal->investment_amount ) / 1000, 2 );
                }
            }
        }
        }

        $total = $quantity * $unit_price;

        // Build purchase row dynamically so we only include columns that exist
        $purchase_row = array(
            'user_id' => $user_id,
            'proposal_id' => $listing->proposal_id,
            'share_quantity' => $quantity,
            'share_price' => $unit_price,
            'total_amount' => $total,
            'payment_gateway' => $payment_method,
            'status' => 'pending',
            'purchased_at' => current_time( 'mysql' ),
            'listing_id' => isset( $listing->id ) ? intval( $listing->id ) : null,
        );

        // Only include payment_data if the purchases table has that column (older installs may not)
        $col_payment = $wpdb->get_var( "SHOW COLUMNS FROM {$purchases_table} LIKE 'payment_data'" );
        if ( $col_payment ) {
            $purchase_row['payment_data'] = maybe_serialize( $payment_payload );
        }

        $inserted = $wpdb->insert( $purchases_table, $purchase_row );

        if ( $inserted === false ) {
            return new WP_Error( 'db_error', 'Failed to create purchase', array( 'status' => 500 ) );
        }

        $purchase_id = $wpdb->insert_id;

        // If the client requested a bank transfer, create a pending invoice and return invoice details
        if ( strtolower( (string) $payment_method ) === 'bank' || strtolower( (string) $payment_method ) === 'bank_transfer' || strtolower( (string) $payment_method ) === 'banktransfer' ) {
            try {
                // Use the site's invoice generator (shared with main plugin) when available
                $invoice_generator_path = '';
                // Primary: main plugin constant
                if ( defined( 'INVESTOR_NETWORK_PLUGIN_DIR' ) ) {
                    $maybe = rtrim( INVESTOR_NETWORK_PLUGIN_DIR, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'payments' . DIRECTORY_SEPARATOR . 'class-investor-network-invoice-generator.php';
                    if ( file_exists( $maybe ) ) {
                        $invoice_generator_path = $maybe;
                    }
                }

                // Secondary: known plugins directory location for the main plugin
                if ( empty( $invoice_generator_path ) && defined( 'WP_PLUGIN_DIR' ) ) {
                    $maybe2 = rtrim( WP_PLUGIN_DIR, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR . 'investor-network' . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'payments' . DIRECTORY_SEPARATOR . 'class-investor-network-invoice-generator.php';
                    if ( file_exists( $maybe2 ) ) {
                        $invoice_generator_path = $maybe2;
                    }
                }

                // Last resort: attempt to locate sibling plugin by walking one directory up
                if ( empty( $invoice_generator_path ) ) {
                    $maybe3 = dirname( dirname( __FILE__ ) ) . DIRECTORY_SEPARATOR . 'investor-network' . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'payments' . DIRECTORY_SEPARATOR . 'class-investor-network-invoice-generator.php';
                    if ( file_exists( $maybe3 ) ) {
                        $invoice_generator_path = $maybe3;
                    }
                }

                if ( $invoice_generator_path ) {
                    require_once $invoice_generator_path;
                } else {
                    error_log( 'Mobile API: invoice generator not found; skipping invoice creation.' );
                }

                if ( class_exists( 'Investor_Network_Invoice_Generator' ) ) {
                    $generator = new Investor_Network_Invoice_Generator();
                    // Due date 30 days from now (matches shortcode behavior)
                    $due_date = date( 'Y-m-d', strtotime( '+30 days' ) );
                    $meta = array(
                        'source' => 'mobile_bank_request',
                        'purchase_id' => $purchase_id,
                        'listing_id' => isset( $listing->id ) ? intval( $listing->id ) : null,
                        'proposal_id' => isset( $listing->proposal_id ) ? intval( $listing->proposal_id ) : null,
                    );
                    // Prepare masked summary of payment_payload for occasional debugging (not logged by default)
                    $mask_info = array();
                    if ( is_array( $payment_payload ) ) {
                        foreach ( $payment_payload as $k => $v ) {
                            $mask_info[ $k ] = is_scalar( $v ) ? ( strlen( (string) $v ) > 8 ? substr( (string) $v, 0, 4 ) . '…(' . strlen( (string) $v ) . ')' : $v ) : gettype( $v );
                        }
                    } else {
                        $mask_info = is_scalar( $payment_payload ) ? ( strlen( (string) $payment_payload ) > 8 ? substr( (string) $payment_payload, 0, 4 ) . '…(' . strlen( (string) $payment_payload ) . ')' : $payment_payload ) : gettype( $payment_payload );
                    }
                    $invoice_id = $generator->generate_single_invoice( intval( $user_id ), floatval( $total ), get_option( 'investor_network_currency', 'USD' ), $due_date, $meta );


                    if ( $invoice_id ) {
                        // Optionally attach invoice_id to the purchase record for linkage if column exists
                        $col_exists = $wpdb->get_var( "SHOW COLUMNS FROM {$purchases_table} LIKE 'invoice_id'" );
                        if ( $col_exists ) {
                            $wpdb->update( $purchases_table, array( 'invoice_id' => $invoice_id ), array( 'id' => $purchase_id ), array( '%d' ), array( '%d' ) );
                        } else {
                            error_log( 'Mobile API: purchases table does not have invoice_id column; skipping update' );
                        }

                        $invoice = array(
                            'id' => $invoice_id,
                            'member_id' => intval( $user_id ),
                            'amount' => floatval( $total ),
                            'currency' => get_option( 'investor_network_currency', 'USD' ),
                            'due_date' => $due_date,
                            'status' => 'pending',
                        );

                        return new WP_REST_Response( array( 'purchase_id' => $purchase_id, 'invoice' => $invoice ), 200 );
                    }
                }
            } catch ( Exception $e ) {
                error_log( 'Mobile API: failed to create invoice for bank transfer: ' . $e->getMessage() );
                // Fall through to returning purchase id only
            }
        }

        return new WP_REST_Response( array( 'purchase_id' => $purchase_id ), 200 );
    } catch ( Throwable $t ) {
        // Catch any exception/fatal and log it, then return a WP_Error with message (but avoid exposing sensitive details)
        error_log( 'investor_network_mobile_purchase_listing exception: ' . $t->getMessage() . "\n" . $t->getTraceAsString() );
        return new WP_Error( 'server_error', 'An internal server error occurred', array( 'status' => 500 ) );
    }
}

function investor_network_mobile_create_stripe_intent( WP_REST_Request $request ) {
    $amount = $request->get_param( 'amount' );
    $currency = $request->get_param( 'currency' );
    $listing_id = $request->get_param( 'listing_id' );

    // Validate listing and availability
    if ( $listing_id ) {
        $availability = investor_network_mobile_get_availability( new WP_REST_Request( array( 'id' => $listing_id ) ) );
        if ( is_wp_error( $availability ) ) {
            return $availability;
        }
        // Check if amount matches
    }

    // Create Stripe PaymentIntent
    if ( ! class_exists( 'Stripe\\PaymentIntent' ) ) {
        return new WP_Error( 'stripe_missing', 'Stripe SDK not available', array( 'status' => 500 ) );
    }

    $secret = get_option( 'investor_network_stripe_secret', '' );
    if ( ! $secret ) {
        return new WP_Error( 'stripe_config', 'Stripe secret not configured', array( 'status' => 500 ) );
    }

    \Stripe\Stripe::setApiKey( $secret );
    try {
        $intent = \Stripe\PaymentIntent::create( array(
            'amount' => $amount * 100,
            'currency' => $currency,
        ) );
        return new WP_REST_Response( array( 'client_secret' => $intent->client_secret ), 200 );
    } catch ( Exception $e ) {
        return new WP_Error( 'stripe_error', $e->getMessage(), array( 'status' => 500 ) );
    }
}

function investor_network_mobile_get_invoices( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    global $wpdb;
    $purchases_table = $wpdb->prefix . 'investor_network_share_purchases';

    $invoices = $wpdb->get_results( $wpdb->prepare(
        "SELECT * FROM {$purchases_table} WHERE user_id = %d ORDER BY purchased_at DESC",
        $user_id
    ) );

    $data = array();
    foreach ( $invoices as $invoice ) {
        // Invoice table columns: id, member_id, amount, currency, status, transaction_id, gateway, due_date, notes, metadata, created_at, updated_at
        $listing_name = 'Invoice #' . $invoice->id;
        $invoice_date = isset( $invoice->created_at ) && $invoice->created_at ? $invoice->created_at : date( 'Y-m-d H:i:s' );
        $amount = isset( $invoice->amount ) ? floatval( $invoice->amount ) : 0;
        $data[] = array(
            'id' => (string) $invoice->id,
            'listingName' => $listing_name,
            'date' => $invoice_date,
            'amount' => $amount,
            'status' => $invoice->status,
        );
    }

    return new WP_REST_Response( $data, 200 );
}

function investor_network_mobile_get_polls( WP_REST_Request $request ) {
    // Simple static polls list for dev/demo. You can replace with DB-driven logic.
    $polls = array(
        array(
            'id' => 1,
            'question' => 'What should be our next investment focus?',
            'options' => array(
                array( 'id' => 1, 'text' => 'Tech Startups', 'votes' => 45 ),
                array( 'id' => 2, 'text' => 'Real Estate', 'votes' => 82 ),
                array( 'id' => 3, 'text' => 'Renewable Energy', 'votes' => 61 ),
            ),
            'isOpen' => true,
            'totalVotes' => 188,
        ),
    );
    return new WP_REST_Response( $polls, 200 );
}

function investor_network_mobile_submit_vote( WP_REST_Request $request ) {
    $id = $request->get_param( 'id' );
    $body = $request->get_json_params();
    $option_id = isset( $body['option_id'] ) ? intval( $body['option_id'] ) : 0;
    if ( ! $option_id ) {
        return new WP_Error( 'invalid', 'Option id is required', array( 'status' => 400 ) );
    }
    // For demo, just return the poll with incremented vote
    $poll = array(
        'id' => $id,
        'question' => 'What should be our next investment focus?',
        'options' => array(
            array( 'id' => 1, 'text' => 'Tech Startups', 'votes' => 45 + ( $option_id === 1 ? 1 : 0 ) ),
            array( 'id' => 2, 'text' => 'Real Estate', 'votes' => 82 + ( $option_id === 2 ? 1 : 0 ) ),
            array( 'id' => 3, 'text' => 'Renewable Energy', 'votes' => 61 + ( $option_id === 3 ? 1 : 0 ) ),
        ),
        'isOpen' => true,
        'totalVotes' => 189,
    );
    return new WP_REST_Response( $poll, 200 );
}

function investor_network_mobile_get_announcements( WP_REST_Request $request ) {
    $announcements = array(
        array( 'id' => 1, 'title' => 'Q4 Financial Results', 'content' => 'We are pleased to announce strong growth in the fourth quarter.', 'date' => '2025-10-20' ),
        array( 'id' => 2, 'title' => 'Annual General Meeting', 'content' => 'The AGM will be held on December 15th. Please RSVP.', 'date' => '2025-10-15' ),
    );
    return new WP_REST_Response( $announcements, 200 );
}

function investor_network_mobile_get_member_profile( WP_REST_Request $request ) {
    $id = intval( $request->get_param( 'id' ) );
    $current = get_current_user_id();
    if ( $current !== $id && ! current_user_can( 'manage_options' ) ) {
        return new WP_Error( 'forbidden', 'Not authorized to view this profile', array( 'status' => 403 ) );
    }

    $user = get_userdata( $id );
    if ( ! $user ) {
        return new WP_Error( 'not_found', 'User not found', array( 'status' => 404 ) );
    }

    $profile = array(
        'id' => $user->ID,
        'username' => $user->user_login,
        'email' => $user->user_email,
        'first_name' => $user->first_name,
        'last_name' => $user->last_name,
        'display_name' => $user->display_name,
        'fullName' => trim( $user->first_name . ' ' . $user->last_name ),
        'bio' => get_user_meta( $id, 'description', true ),
        // Contact / profile fields (match shortcode `get_member_data` keys)
        'phone' => get_user_meta( $id, 'phone', true ),
        'location' => get_user_meta( $id, 'location', true ),
        'linkedin_profile' => get_user_meta( $id, 'linkedin_profile', true ),
        'company_name' => get_user_meta( $id, 'company_name', true ),
        'industry' => get_user_meta( $id, 'industry', true ),
        'role_title' => get_user_meta( $id, 'role_title', true ),
        'team_size' => get_user_meta( $id, 'team_size', true ),
        'annual_revenue' => get_user_meta( $id, 'annual_revenue', true ),
        'website' => get_user_meta( $id, 'website', true ),
        // Address fields
        'address_line1' => get_user_meta( $id, 'address_line1', true ),
        'address_line2' => get_user_meta( $id, 'address_line2', true ),
        'city' => get_user_meta( $id, 'city', true ),
        'state' => get_user_meta( $id, 'state', true ),
        'postal_code' => get_user_meta( $id, 'postal_code', true ),
        'country' => get_user_meta( $id, 'country', true ),
        'investor_gender' => get_user_meta( $id, 'investor_gender', true ),
        // Avatar (attachment id stored in user meta by shortcode handlers)
        'avatar_url' => '',
    );

    // Populate avatar_url if custom avatar is set
    $avatar_meta = get_user_meta( $id, 'investor_custom_avatar', true );
    if ( ! empty( $avatar_meta ) ) {
        // If meta is numeric attachment id, get its URL
        if ( is_numeric( $avatar_meta ) ) {
            $avatar_url = wp_get_attachment_image_url( intval( $avatar_meta ), 'thumbnail' );
            if ( $avatar_url ) {
                $profile['avatar_url'] = $avatar_url;
            }
        } elseif ( is_string( $avatar_meta ) ) {
            // If it's already a URL string, use it
            $profile['avatar_url'] = esc_url_raw( $avatar_meta );
        }
    }

    return new WP_REST_Response( $profile, 200 );
}

/**
 * Purchase shares for a proposal (primary market) — minimal implementation for mobile.
 * Expects JSON body: { quantity: int, payment_method: string, payment_payload?: object }
 */
function investor_network_mobile_purchase_proposal( WP_REST_Request $request ) {
    $proposal_id = intval( $request->get_param( 'id' ) );
    $body = $request->get_json_params();
    $quantity = isset( $body['quantity'] ) ? intval( $body['quantity'] ) : 0;
    $payment_method = isset( $body['payment_method'] ) ? sanitize_text_field( $body['payment_method'] ) : '';
    $payment_payload = isset( $body['payment_payload'] ) ? $body['payment_payload'] : array();

    if ( $proposal_id <= 0 ) return new WP_Error( 'invalid', 'Invalid proposal id', array( 'status' => 400 ) );
    if ( $quantity <= 0 ) return new WP_Error( 'invalid', 'Quantity must be > 0', array( 'status' => 400 ) );
    if ( empty( $payment_method ) ) return new WP_Error( 'invalid', 'payment_method is required', array( 'status' => 400 ) );

    $user_id = get_current_user_id();
    if ( ! $user_id ) return new WP_Error( 'forbidden', 'Not authenticated', array( 'status' => 401 ) );

    global $wpdb;
    $proposals_table = $wpdb->prefix . 'investor_network_proposals';
    $purchases_table = $wpdb->prefix . 'investor_network_share_purchases';

    $proposal = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$proposals_table} WHERE id = %d", $proposal_id ) );
    if ( ! $proposal ) return new WP_Error( 'not_found', 'Proposal not found', array( 'status' => 404 ) );

    // Compute per-share price: use investment_amount / 1000 (same as shortcode)
    $investment_amount = floatval( $proposal->investment_amount ?? 0 );
    $share_price = $investment_amount > 0 ? round( ( $investment_amount / 1000 ), 2 ) : 0.0;
    $total_amount = $share_price * $quantity;

    // Determine status: bank -> pending, stripe -> completed (mobile will handle actual Stripe intent separately)
    $status = ( strtolower( $payment_method ) === 'bank' ) ? 'pending' : 'completed';

    $inserted = $wpdb->insert( $purchases_table, array(
        'user_id' => $user_id,
        'proposal_id' => $proposal_id,
        'share_quantity' => $quantity,
        'share_price' => $share_price,
        'total_amount' => $total_amount,
        'transaction_id' => isset( $payment_payload['transaction_id'] ) ? sanitize_text_field( $payment_payload['transaction_id'] ) : '',
        'payment_gateway' => sanitize_text_field( $payment_method ),
        'status' => $status,
        'purchased_at' => current_time( 'mysql' ),
    ) );

    if ( $inserted === false ) {
        return new WP_Error( 'db_error', 'Failed to record purchase', array( 'status' => 500 ) );
    }

    $purchase_id = intval( $wpdb->insert_id );

    // Minimal invoice-like response for mobile UI
    $invoice = array(
        'id' => $purchase_id,
        'member_id' => $user_id,
        'amount' => $total_amount,
        'currency' => get_option( 'investor_network_currency', 'USD' ),
        'due_date' => date( 'Y-m-d', strtotime( '+30 days' ) ),
        'status' => $status,
    );

    return new WP_REST_Response( array( 'purchase_id' => $purchase_id, 'invoice' => $invoice ), 200 );
}

function investor_network_mobile_update_member_profile( WP_REST_Request $request ) {
    $id = intval( $request->get_param( 'id' ) );
    $current = get_current_user_id();
    if ( $current !== $id && ! current_user_can( 'manage_options' ) ) {
        return new WP_Error( 'forbidden', 'Not authorized to update this profile', array( 'status' => 403 ) );
    }

    $body = $request->get_json_params();
    if ( ! is_array( $body ) ) {
        return new WP_Error( 'invalid', 'Invalid request body', array( 'status' => 400 ) );
    }

    $update = array( 'ID' => $id );
    // Basic WP user fields
    if ( isset( $body['first_name'] ) ) {
        $update['first_name'] = sanitize_text_field( $body['first_name'] );
    }
    if ( isset( $body['last_name'] ) ) {
        $update['last_name'] = sanitize_text_field( $body['last_name'] );
    }
    if ( isset( $body['display_name'] ) ) {
        $update['display_name'] = sanitize_text_field( $body['display_name'] );
    }
    if ( isset( $body['email'] ) ) {
        $email = sanitize_email( $body['email'] );
        if ( $email && $email !== get_userdata( $id )->user_email && email_exists( $email ) ) {
            return new WP_Error( 'email_in_use', 'Email already in use', array( 'status' => 400 ) );
        }
        $update['user_email'] = $email;
    }

    $result = wp_update_user( $update );
    if ( is_wp_error( $result ) ) {
        return $result;
    }

    // Meta fields to update (match shortcode keys)
    $meta_fields = array(
        'phone', 'location', 'linkedin_profile', 'company_name',
        'industry', 'role_title', 'team_size', 'annual_revenue', 'website',
        'address_line1','address_line2','city','state','postal_code','country',
        'investor_gender', 'description'
    );

    foreach ( $meta_fields as $field ) {
        if ( array_key_exists( $field, $body ) ) {
            $value = $body[ $field ];
            if ( in_array( $field, array( 'website', 'linkedin_profile' ), true ) ) {
                $value = esc_url_raw( $value );
            } else {
                $value = sanitize_text_field( $value );
            }
            update_user_meta( $id, $field === 'description' ? 'description' : $field, $value );
        }
    }

    // Return updated profile
    $req = new WP_REST_Request();
    $req->set_param( 'id', $id );
    return investor_network_mobile_get_member_profile( $req );
}

/**
 * Change a user's password. Expects JSON body with 'current_password' and 'new_password'.
 */
function investor_network_mobile_change_password( WP_REST_Request $request ) {
    $id = intval( $request->get_param( 'id' ) );
    $current = get_current_user_id();
    if ( $current !== $id && ! current_user_can( 'manage_options' ) ) {
        return new WP_Error( 'forbidden', 'Not authorized to change this password', array( 'status' => 403 ) );
    }

    $body = $request->get_json_params();
    if ( ! is_array( $body ) ) {
        return new WP_Error( 'invalid', 'Invalid request body', array( 'status' => 400 ) );
    }

    $current_password = isset( $body['current_password'] ) ? $body['current_password'] : '';
    $new_password = isset( $body['new_password'] ) ? $body['new_password'] : '';

    if ( empty( $current_password ) || empty( $new_password ) ) {
        return new WP_Error( 'invalid', 'Both current_password and new_password are required', array( 'status' => 400 ) );
    }

    $user = get_userdata( $id );
    if ( ! $user ) {
        return new WP_Error( 'not_found', 'User not found', array( 'status' => 404 ) );
    }

    // Verify current password
    if ( ! wp_check_password( $current_password, $user->user_pass, $user->ID ) ) {
        return new WP_Error( 'invalid_credentials', 'Current password is incorrect', array( 'status' => 403 ) );
    }

    // Set the new password. wp_set_password does not return a WP_Error; it updates the hash and clears sessions.
    wp_set_password( $new_password, $id );

    // Inform the client that they should re-authenticate.
    return new WP_REST_Response( array( 'success' => true, 'message' => 'Password changed; please sign in again.' ), 200 );
}

function investor_network_mobile_upload_avatar_rest( WP_REST_Request $request ) {
    $id = intval( $request->get_param( 'id' ) );
    $current = get_current_user_id();
    if ( $current !== $id && ! current_user_can( 'manage_options' ) ) {
        return new WP_Error( 'forbidden', 'Not authorized to upload avatar for this user', array( 'status' => 403 ) );
    }

    $files = $request->get_file_params();
    if ( empty( $files['avatar'] ) ) {
        return new WP_Error( 'no_file', 'No avatar file provided', array( 'status' => 400 ) );
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $file = $files['avatar'];
    $overrides = array( 'test_form' => false );
    $uploaded = wp_handle_upload( $file, $overrides );
    if ( isset( $uploaded['error'] ) ) {
        return new WP_Error( 'upload_error', $uploaded['error'], array( 'status' => 500 ) );
    }

    // Insert attachment
    $attachment_id = wp_insert_attachment( array(
        'post_mime_type' => $uploaded['type'],
        'post_title' => sanitize_file_name( basename( $uploaded['file'] ) ),
        'post_content' => '',
        'post_status' => 'inherit',
    ), $uploaded['file'] );

    if ( is_wp_error( $attachment_id ) ) {
        return $attachment_id;
    }

    $metadata = wp_generate_attachment_metadata( $attachment_id, $uploaded['file'] );
    wp_update_attachment_metadata( $attachment_id, $metadata );

    // Save attachment id to user meta
    update_user_meta( $id, 'investor_custom_avatar', $attachment_id );

    $avatar_url = wp_get_attachment_image_url( $attachment_id, 'thumbnail' );
    return new WP_REST_Response( array( 'attachment_id' => $attachment_id, 'avatar_url' => $avatar_url ), 200 );
}

function investor_network_mobile_get_member_profile_public( WP_REST_Request $request ) {
    $id = intval( $request->get_param( 'id' ) );
    $user = get_userdata( $id );
    if ( ! $user ) {
        return new WP_Error( 'not_found', 'User not found', array( 'status' => 404 ) );
    }

    $profile = array(
        'id' => $user->ID,
        'username' => $user->user_login,
        'display_name' => $user->display_name,
        'fullName' => trim( $user->first_name . ' ' . $user->last_name ),
        'company_name' => get_user_meta( $id, 'company_name', true ),
        'location' => get_user_meta( $id, 'location', true ),
        'avatar_url' => '',
    );

    $avatar_meta = get_user_meta( $id, 'investor_custom_avatar', true );
    if ( ! empty( $avatar_meta ) ) {
        if ( is_numeric( $avatar_meta ) ) {
            $avatar_url = wp_get_attachment_image_url( intval( $avatar_meta ), 'thumbnail' );
            if ( $avatar_url ) {
                $profile['avatar_url'] = $avatar_url;
            }
        } elseif ( is_string( $avatar_meta ) ) {
            $profile['avatar_url'] = esc_url_raw( $avatar_meta );
        }
    }

    return new WP_REST_Response( $profile, 200 );
}

function investor_network_mobile_get_member_profile_me( WP_REST_Request $request ) {
    $id = get_current_user_id();
    if ( ! $id ) {
        return new WP_Error( 'forbidden', 'Not authenticated', array( 'status' => 401 ) );
    }
    $request->set_param( 'id', $id );
    return investor_network_mobile_get_member_profile( $request );
}

/**
 * Wrapper for /members/me/dashboard so clients can call the authenticated
 * endpoint without supplying a numeric id. Sets the `id` param to the
 * current user and delegates to investor_network_mobile_get_member_dashboard.
 */
function investor_network_mobile_get_member_dashboard_me( WP_REST_Request $request ) {
    $id = get_current_user_id();
    if ( ! $id ) {
        return new WP_Error( 'forbidden', 'Not authenticated', array( 'status' => 401 ) );
    }
    $request->set_param( 'id', $id );
    return investor_network_mobile_get_member_dashboard( $request );
}

function investor_network_mobile_upload_receipt( WP_REST_Request $request ) {
    $id = $request->get_param( 'id' );
    $files = $request->get_file_params();

    if ( empty( $files['receipt'] ) ) {
        return new WP_Error( 'no_file', 'No receipt file provided', array( 'status' => 400 ) );
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    $file = $files['receipt'];
    $overrides = array( 'test_form' => false );
    $uploaded = wp_handle_upload( $file, $overrides );

    if ( isset( $uploaded['error'] ) ) {
        return new WP_Error( 'upload_error', $uploaded['error'], array( 'status' => 500 ) );
    }

    // Attach to invoice
    $attachment_id = wp_insert_attachment( array(
        'post_mime_type' => $uploaded['type'],
        'post_title' => sanitize_file_name( basename( $uploaded['file'] ) ),
        'post_content' => '',
        'post_status' => 'inherit',
    ), $uploaded['file'] );

    if ( is_wp_error( $attachment_id ) ) {
        return $attachment_id;
    }

    require_once ABSPATH . 'wp-admin/includes/image.php';
    $metadata = wp_generate_attachment_metadata( $attachment_id, $uploaded['file'] );
    wp_update_attachment_metadata( $attachment_id, $metadata );

    // Update purchase record
    global $wpdb;
    $purchases_table = $wpdb->prefix . 'investor_network_share_purchases';
    $wpdb->update( $purchases_table, array( 'receipt_attachment_id' => $attachment_id ), array( 'id' => $id ) );

    return new WP_REST_Response( array( 'attachment_id' => $attachment_id ), 200 );
}

function investor_network_mobile_mark_invoice_paid( WP_REST_Request $request ) {
    $id = $request->get_param( 'id' );
    $user_id = get_current_user_id();

    global $wpdb;
    $purchases_table = $wpdb->prefix . 'investor_network_share_purchases';

    // Check ownership
    $purchase = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$purchases_table} WHERE id = %d", $id ) );
    if ( ! $purchase || $purchase->user_id != $user_id ) {
        return new WP_Error( 'forbidden', 'Not authorized', array( 'status' => 403 ) );
    }

    $updated = $wpdb->update( $purchases_table, array( 'status' => 'completed' ), array( 'id' => $id ) );

    if ( ! $updated ) {
        return new WP_Error( 'update_error', 'Failed to update', array( 'status' => 500 ) );
    }

    return new WP_REST_Response( array( 'status' => 'completed' ), 200 );
}

function investor_network_mobile_get_bank_details( WP_REST_Request $request ) {
    $details = get_option( 'investor_network_bank_transfer_info', '' );
    return new WP_REST_Response( array( 'bank_details' => $details ), 200 );
}

function investor_network_mobile_get_member_dashboard( WP_REST_Request $request ) {
    $id = intval( $request->get_param( 'id' ) );

    // Ensure the requester is the same user or an admin
    $current = get_current_user_id();
    if ( $current !== $id && ! current_user_can( 'manage_options' ) ) {
        return new WP_Error( 'forbidden', 'Not authorized to view this dashboard', array( 'status' => 403 ) );
    }

    global $wpdb;
    $purchases_table = $wpdb->prefix . 'investor_network_share_purchases';
    $invoices_table = $wpdb->prefix . 'investor_network_invoices';

    // Monthly contribution: pending invoice amount or last payment
    $monthlyContribution = 0;
    $contributionStatus = 'paid'; // Default to paid

    // First, check for pending invoices for this user
    $pending_invoice = $wpdb->get_row( $wpdb->prepare(
        "SELECT amount FROM {$invoices_table} WHERE member_id = %d AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
        $id
    ) );

    if ( $pending_invoice ) {
        $monthlyContribution = floatval( $pending_invoice->amount );
        $contributionStatus = 'required';
    } else {
        // No pending invoice, get the latest paid invoice amount
        $last_paid_invoice = $wpdb->get_row( $wpdb->prepare(
            "SELECT amount FROM {$invoices_table} WHERE member_id = %d AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
            $id
        ) );
        if ( $last_paid_invoice ) {
            $monthlyContribution = floatval( $last_paid_invoice->amount );
            $contributionStatus = 'paid';
        }
    }

    // Contribution balance: total amount invested by user (completed purchases)
    $contributionBalance = floatval( $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(total_amount),0) FROM {$purchases_table} WHERE user_id = %d AND status = 'completed'", $id ) ) );

    // Recent transactions (last 5)
    $transactions = $wpdb->get_results( $wpdb->prepare(
        "SELECT id, total_amount as amount, purchased_at as date, status FROM {$purchases_table} WHERE user_id = %d ORDER BY purchased_at DESC LIMIT 5",
        $id
    ) );

    // Group stats: total members and total invested
    $totalMembers = count_users();
    $totalMembersCount = isset( $totalMembers['total_users'] ) ? intval( $totalMembers['total_users'] ) : 0;
    $totalInvested = floatval( $wpdb->get_var( "SELECT COALESCE(SUM(total_amount),0) FROM {$purchases_table} WHERE status = 'completed'" ) );

    // Reliability: percentage of this user's purchases that completed
    $user_total_purchases = intval( $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$purchases_table} WHERE user_id = %d", $id ) ) );
    $user_completed_purchases = intval( $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$purchases_table} WHERE user_id = %d AND status = 'completed'", $id ) ) );
    $reliability = $user_total_purchases > 0 ? round( ( $user_completed_purchases / $user_total_purchases ) * 100, 1 ) : 0.0;

    // Participation: percent of total invested by this user vs group total
    $user_total_invested = floatval( $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(total_amount),0) FROM {$purchases_table} WHERE user_id = %d AND status = 'completed'", $id ) ) );
    $participation = $totalInvested > 0 ? round( ( $user_total_invested / $totalInvested ) * 100, 1 ) : 0.0;

    // Overall reputation score: simple average of reliability and participation (0-100)
    $overallScore = round( ( $reliability + $participation ) / 2, 1 );

    // Top members by total invested (exclude admins). Query extra rows then filter.
    $top_members = $wpdb->get_results( "SELECT user_id, COALESCE(SUM(total_amount),0) AS total_invested FROM {$purchases_table} WHERE status = 'completed' GROUP BY user_id ORDER BY total_invested DESC LIMIT 10" );
    $topMembers = array();
    if ( $top_members ) {
        foreach ( $top_members as $tm ) {
            $uid = intval( $tm->user_id );
            // Skip admin users
            if ( user_can( $uid, 'manage_options' ) ) {
                continue;
            }
            $u = get_userdata( $uid );
            $topMembers[] = array(
                'id' => $uid,
                'displayName' => $u ? $u->display_name : ( 'User ' . $uid ),
                'totalInvested' => floatval( $tm->total_invested ),
            );
            // Limit to 5 non-admin members
            if ( count( $topMembers ) >= 5 ) {
                break;
            }
        }
    }

    $data = array(
        'contributionRequirement' => $monthlyContribution,
        'contributionStatus' => $contributionStatus,
        'contributionBalance' => $contributionBalance,
        'transactions' => $transactions,
        'groupStats' => array(
            'totalMembers' => $totalMembersCount,
            'totalInvested' => $totalInvested,
        ),
        // Reputation metrics
        'reputation' => array(
            'overallScore' => $overallScore,
            'reliability' => $reliability,
            'participation' => $participation,
            'topMembers' => $topMembers,
        ),
    );

    return new WP_REST_Response( $data, 200 );
}

/**
 * Return settings for the current user. If authenticated, returns notification
 * preferences and basic UI options. This mirrors the shape expected by the
 * mobile client `UserSettings` type.
 */
function investor_network_mobile_get_settings( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( ! $user_id ) {
        return new WP_Error( 'forbidden', 'Not authenticated', array( 'status' => 401 ) );
    }

    // Defaults
    $settings = array(
        'enableEmailNotifications' => (bool) get_user_meta( $user_id, 'enable_email_notifications', true ),
        'enablePushNotifications' => (bool) get_user_meta( $user_id, 'enable_push_notifications', true ),
        'notificationTopics' => array(
            'newInvestments' => (bool) get_user_meta( $user_id, 'notify_new_investments', true ),
            'qnaUpdates' => (bool) get_user_meta( $user_id, 'notify_qna_updates', true ),
            'monthlyDigest' => (bool) get_user_meta( $user_id, 'notify_monthly_digest', true ),
        ),
    );

    return new WP_REST_Response( $settings, 200 );
}


/**
 * Update settings for the current user. Accepts JSON body with keys matching
 * the structure returned by GET /settings.
 */
function investor_network_mobile_update_settings( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( ! $user_id ) {
        return new WP_Error( 'forbidden', 'Not authenticated', array( 'status' => 401 ) );
    }

    $body = $request->get_json_params();
    if ( ! is_array( $body ) ) {
        return new WP_Error( 'invalid', 'Invalid request body', array( 'status' => 400 ) );
    }

    if ( array_key_exists( 'enableEmailNotifications', $body ) ) {
        update_user_meta( $user_id, 'enable_email_notifications', boolval( $body['enableEmailNotifications'] ) );
    }
    if ( array_key_exists( 'enablePushNotifications', $body ) ) {
        update_user_meta( $user_id, 'enable_push_notifications', boolval( $body['enablePushNotifications'] ) );
    }

    if ( isset( $body['notificationTopics'] ) && is_array( $body['notificationTopics'] ) ) {
        $topics = $body['notificationTopics'];
        if ( array_key_exists( 'newInvestments', $topics ) ) {
            update_user_meta( $user_id, 'notify_new_investments', boolval( $topics['newInvestments'] ) );
        }
        if ( array_key_exists( 'qnaUpdates', $topics ) ) {
            update_user_meta( $user_id, 'notify_qna_updates', boolval( $topics['qnaUpdates'] ) );
        }
        if ( array_key_exists( 'monthlyDigest', $topics ) ) {
            update_user_meta( $user_id, 'notify_monthly_digest', boolval( $topics['monthlyDigest'] ) );
        }
    }

    // Return the updated settings
    $req = new WP_REST_Request();
    return investor_network_mobile_get_settings( $req );
}

function investor_network_mobile_register_device_token( WP_REST_Request $request ) {
    $token = $request->get_param( 'token' );
    $platform = $request->get_param( 'platform' );
    $user_id = get_current_user_id();

    // Store token, e.g., in user meta
    update_user_meta( $user_id, 'device_token', $token );
    update_user_meta( $user_id, 'device_platform', $platform );

    return new WP_REST_Response( array( 'success' => true ), 200 );
}
