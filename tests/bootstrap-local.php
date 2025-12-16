<?php
// Bootstrap to run tests against the local XAMPP WordPress install.
// Adjust the path to your local WordPress installation if needed.
define( 'WP_USE_THEMES', false );
// Path to local WP installation (XAMPP htdocs 'word' site)
$wp_load = 'D:/xampp/htdocs/word/wp-load.php';
if ( ! file_exists( $wp_load ) ) {
    echo "Could not find local wp-load.php at $wp_load. Please adjust tests/bootstrap-local.php\n";
    exit(1);
}
require_once $wp_load;

// Ensure plugin file is loaded for tests (relative to plugin directory)
// Define plugin dir constant expected by the plugin when loaded directly
if ( ! defined( 'INVESTOR_NETWORK_PLUGIN_DIR' ) ) {
    define( 'INVESTOR_NETWORK_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
}
require_once dirname( __DIR__ ) . '/investor-network-mobile-api.php';

// Start the REST server if not already
if ( ! defined( 'REST_SERVER' ) ) {
    // no-op; rest_do_request will initialize the server when needed
}
