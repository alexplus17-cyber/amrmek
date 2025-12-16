<?php
// CLI test to invoke investor_network_mobile_get_documents() within WP context
chdir(dirname(__DIR__, 3)); // change to wp-content/plugins/..?? safer to use absolute path below
require 'D:/xampp/htdocs/word/wp-load.php';

// Set current user to admin (1) to bypass JWT
if ( function_exists('wp_set_current_user') ) {
    wp_set_current_user(1);
}

// Build a minimal WP_REST_Request substitute if class not available
if ( ! class_exists('WP_REST_Request') ) {
    echo "WP_REST_Request not available\n";
}

$request = null;
if ( class_exists('WP_REST_Request') ) {
    $request = new WP_REST_Request('GET', '/investor-network/v1/documents');
    $request->set_param('per_page', 100);
}

try {
    $resp = investor_network_mobile_get_documents( $request );
    if ( is_wp_error( $resp ) ) {
        echo "WP_Error:\n";
        var_export( $resp->get_error_message() );
        echo "\nData:\n";
        var_export( $resp->get_error_data() );
        echo "\n";
    } else {
        echo "Response:\n";
        var_export( $resp );
        echo "\n";
    }
} catch ( Throwable $t ) {
    echo "Exception: " . $t->getMessage() . "\n";
    echo $t->getTraceAsString();
}

// Tail debug.log
$log = 'D:/xampp/htdocs/word/wp-content/debug.log';
if ( file_exists($log) ) {
    $lines = file($log, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $tail = array_slice($lines, -200);
    echo "\n---- debug.log tail ----\n";
    echo implode("\n", $tail);
}
