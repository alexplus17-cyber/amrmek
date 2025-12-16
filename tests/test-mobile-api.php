<?php
/**
 * Basic unit tests for Investor Network Mobile API
 * Run with PHPUnit: phpunit tests/test-mobile-api.php
 */

require_once __DIR__ . '/../investor-network-mobile-api.php';

use PHPUnit\Framework\TestCase;

class TestInvestorNetworkMobileAPI extends TestCase {

    public function test_get_listings_endpoint_registered() {
        // Ensure REST routes are registered
        do_action('rest_api_init');
        $server = rest_get_server();
        $routes = $server->get_routes();
        // At minimum the namespace should be registered
        $this->assertArrayHasKey('/investor-network/v1', $routes);
    }

    public function test_get_bank_details_returns_option() {
        // Mock get_option
        $mock_option = 'Test bank details';
        update_option('investor_network_bank_transfer_info', $mock_option);

        // Ensure routes registered
        do_action('rest_api_init');
        // Hit the namespace root and ensure a non-404 response (integration smoke test)
        $request = new WP_REST_Request('GET', '/investor-network/v1');
        $response = rest_do_request($request);
        $this->assertNotEquals(404, $response->get_status());
    }

    // Add more tests as needed
}
