<?php
define( 'WP_USE_THEMES', false );
require 'D:/xampp/htdocs/word/wp-load.php';
if ( ! defined( 'INVESTOR_NETWORK_PLUGIN_DIR' ) ) {
    define( 'INVESTOR_NETWORK_PLUGIN_DIR', __DIR__ . '/' );
}
require_once __DIR__ . '/investor-network-mobile-api.php';
do_action('rest_api_init');
$server = rest_get_server();
$routes = $server->get_routes();
echo "Registered routes:\n";
foreach (array_keys($routes) as $k) {
    echo $k . "\n";
}
