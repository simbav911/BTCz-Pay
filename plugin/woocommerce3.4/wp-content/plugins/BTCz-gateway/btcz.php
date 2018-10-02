<?php
/**
 * Plugin Name:         WooCommerce - BTCz Gateway
 * Description:         Allows you to use BTCz payment gateway with the WooCommerce plugin powered by pay.BTCz.app.
 * Author:              BTCz.app
 * Author URI:          https://pay.BTCz.app
 * License:             MIT
 * Version:             0.1.0
 * Requires at least:   3.4
 *
 */

if (!function_exists('is_woocommerce_active'))
    require_once 'woo-includes/woo-functions.php';

add_action('plugins_loaded', 'add_woocommerce_btcz_gateway', 1);

function add_woocommerce_btcz_gateway() {

    register_activation_hook(__FILE__, 'woocommerce_btcz_activate');

    function woocommerce_btcz_activate() {
        if (!class_exists('WC_Payment_Gateway'))
            add_action('admin_notices', 'woocommerce_btcz_CheckNotice');

        if (!function_exists('curl_init'))
            add_action('admin_notices', 'woocommerce_btcz_CheckNoticeCURL');
    }

    add_action('admin_init', 'woocommerce_btcz_check', 0);

    function woocommerce_btcz_check() {
        if (!class_exists('WC_Payment_Gateway')) {
            deactivate_plugins(plugin_basename(__FILE__));
            add_action('admin_notices', 'woocommerce_btcz_CheckNotice');
        }
    }

    function woocommerce_btcz_CheckNotice() {
        echo __('<div class="error"><p>WooCommerce is not installed or is inactive.  Please install/activate WooCommerce before activating the WooCommerce BTCz Plugin</p></div>');
    }

    function woocommerce_btcz_CheckNoticeCURL() {
        echo __('<div class="error"><p>PHP CURL is required for the WooCommerce BTCz Plugin</p></div>');
    }

    add_filter('woocommerce_payment_gateways', 'add_btcz_gateway', 40);

    function add_btcz_gateway($methods) {
        $methods[] = 'WC_Gateway_Btcz';
        return $methods;
    }

    /* Don't continue if WooCommerce isn't activated. */
    if (!class_exists('WC_Payment_Gateway'))
        return false;

    class WC_Gateway_Btcz extends WC_Payment_Gateway {

        public function __construct() {
            $this->plugin_dir   = trailingslashit(dirname(__FILE__));
            $this->id           = 'btcz';
            $this->icon         = apply_filters('woocommerce_btcz_icon', plugin_dir_url(__FILE__) . 'btcz.png');
            $this->has_fields   = false;
            $this->method_title = __('BTCz (Powered by pay.btcz.app)');

            /* Load the form fields. */
            $this->init_form_fields();

            /* btcz Configuration. */
            $this->init_settings();

            $this->enabled       = $this->settings['enabled'];
            $this->title         = $this->settings['title'];
            $this->description   = $this->settings['description'];
            $this->walletAddress = $this->settings['wallet_address'];
            $this->secret 	     = $this->settings['secret'];
            $this->email         = $this->settings['merchant_email'];

            add_action('woocommerce_update_options_payment_gateways_btcz', array(
                &$this,
                'process_admin_options'
            ));
            add_action('woocommerce_receipt_btcz', array(
                &$this,
                'receipt_page'
            ));
        }


        // Initialise Gateway Settings Form Fields
        function init_form_fields()  {

            $this->form_fields = array(
                'enabled' => array(
                    'title' => __('Enable/Disable'),
                    'type' => 'checkbox',
                    'label' => __('Enable BTCz Payment Gateway'),
                    'default' => 'yes'
                ),
                'title' => array(
                    'title' => __('Title'),
                    'type' => 'text',
                    'description' => __('This controls the title which the user sees during checkout.', 'wc_amazon_sp'),
                    'default' => __('BTCz')
                ),
                'description' => array(
                    'title' => __('Description'),
                    'type' => 'textarea',
                    'description' => __('This controls the description which the user sees during checkout.'),
                    'default' => __("Checkout securely with pay.btcz.app")
                ),
                'wallet_address' => array(
                    'title' => __('BTCz Wallet Address'),
                    'type' => 'text',
                    'description' => __('The BTCz Wallet Address you want to receive funds. '),
                    'default' => ''
                ),
				        'merchant_email' => array(
                    'title' => __('Merchant Email Address'),
                    'type' => 'text',
                    'description' => __('Your email address. '),
                    'default' => ''
                )
            );

        } // End init_form_fields()


        // Admin Panel Options
        public function admin_options() {

          ?>
              <h3>
          <?php
              _e('BTCz');
          ?>
              </h3>
              <p>
          <?php
              _e('BTCz works by generating an invoice powered by <a href="https://pay.btcz.app">pay.btcz.app</a>');
          ?>
              </p>
              <table class="form-table">
          <?php
              // Generate the HTML For the settings form.
              $this->generate_settings_html();
          ?>
              </table>
              <!--/.form-table-->
          <?php
        } // End admin_options()


    		public function CreateGateway($MerchantAddress, $srvPingbackUrl, $errReturnUrl, $successReturnUrl, $MerchantEmail, $InvoiceID, $Amount, $Expire, $Secret, $CurrencyCode) {

    			$APIUrl = 'https://pay.btcz.app/api/request_payment';
          // pay.btcz.app/api/request_payment/:amount/:currency/:message/:seller_address/:customer_email/:pingback_success

          $query = urlencode(urlencode($srvPingbackUrl))  . "/" . urlencode(urlencode($successReturnUrl)). "/" . urlencode(urlencode($errReturnUrl));

          $ch = curl_init();
          curl_setopt_array($ch, array(
              CURLOPT_URL => "$APIUrl/" . urlencode($Amount) . "/" . urlencode($CurrencyCode)  . "/hello/" . urlencode($MerchantAddress) . "/" . urlencode($MerchantEmail) . "/" . $query,
              CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
              CURLOPT_CUSTOMREQUEST => "GET",
              CURLOPT_HTTPHEADER => array(
                  "cache-control: no-cache"
              ),
          ));

          //curl_setopt($ch, CURLOPT_URL, $url);
          curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
          curl_setopt($ch, CURLOPT_USERAGENT, "WP-Woo Plugin/0.1 ($MerchantEmail)");

          $result = curl_exec($ch);
          $info = curl_getinfo($ch);

    			curl_close($ch);

    			if($info['http_code'] != 200)
    				return false;

    			return $result;
    		}


        // Receipt page
        function receipt_page($order_id) {

          $order = new WC_Order($order_id);

    			$dateCompleted = $order->get_date_completed();
    			if(!empty($dateCompleted))
    				echo 'Payment has already been completed for this order.';


    			$currentTXID = $order->get_transaction_id($this);



    			if(strlen($currentTXID) != 36) {



    				$srvPingbackUrl = $order->get_checkout_order_received_url();
            $successPingbackUrl = $order->get_view_order_url();
            $errPingbackUrl = $successPingbackUrl; // $order->get_view_order_url()."&woocommerce_btcz_confirm=0";


    				$RESP =  $this->CreateGateway($this->walletAddress, $srvPingbackUrl, $errPingbackUrl, $successPingbackUrl, $this->email, $order->id, round($order->get_total(), 2), 15, $this->secret, get_woocommerce_currency());



            $JSON_RESP = json_decode($RESP);

    				if(!empty($JSON_RESP)) {
    					$uID = $JSON_RESP->id;
    					$currentTXID = $uID;
    					$order->set_transaction_id($currentTXID);
    					$order->add_order_note("BTCz gateway generated: ".$currentTXID);
    					$order->save();

    				}
    			} else {
    				$uID = $currentTXID;
    			}


    			if(isset($uID) && !empty($uID) && strlen($uID) == 36) {

    				$InvoiceURL = "https://pay.btcz.app/invoice/".$uID;
    				echo 'Please pay below:<br><br><iframe id="iFrame" style="min-height: 765px" width="100%"  frameborder="0" src="'.$InvoiceURL.'" scrolling="no" onload="resizeIframe()"></iframe>';
    				echo "<script type=\"text/javascript\">
    				function resizeIframe() {
    					var obj = document.getElementById(\"iFrame\");
    					obj.style.height = (obj.contentWindow.document.body.scrollHeight) + 'px';
    					setTimeout('resizeIframe()', 200);
    				}
    				</script>";
    			} else if(strlen($RESP)) {
    				echo $RESP; //Printable error
    			} else {
    				echo "Error: No response from API"; //Unknown error
    			}
        }


        // Payment fields
        function payment_fields() {

            if (!empty($this->description))
                echo wpautop(wptexturize($this->description));

        }


        // Process the payment and return the result
        function process_payment($order_id) {

            $order = new WC_Order($order_id);

            // Return thankyou redirect
            return array(
                'result' => 'success',
                'redirect' => add_query_arg('order', $order->id, add_query_arg('key', $order->order_key, get_permalink(woocommerce_get_page_id('pay'))))
            );

        }


    		public function getRealClientIP() {

    			if (function_exists('getallheaders')) {
    				$headers = getallheaders();
    			} else {
    				$headers = $_SERVER;
    			}

    			//Get the forwarded IP if it exists
    			if (array_key_exists('X-Forwarded-For', $headers)
    				&& filter_var($headers['X-Forwarded-For'], FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)
    			) {
    				$the_ip = $headers['X-Forwarded-For'];
    			} elseif (array_key_exists('HTTP_X_FORWARDED_FOR', $headers)
    				&& filter_var($headers['HTTP_X_FORWARDED_FOR'], FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)
    			) {
    				$the_ip = $headers['HTTP_X_FORWARDED_FOR'];
    			} elseif(array_key_exists('Cf-Connecting-Ip', $headers)) {
    				$the_ip = $headers['Cf-Connecting-Ip'];
    			} else {
    				$the_ip = filter_var($_SERVER['REMOTE_ADDR'], FILTER_VALIDATE_IP, FILTER_FLAG_IPV4);
    			}
    			return $the_ip;
    		}


        public function processTX() {


          echo "hhh";

          if(!isset($_GET['view-order']) || !ctype_alnum($_GET['view-order']) || strlen($_GET['view-order']) > 128 || !isset($_POST["data"]))
          	die();

          $Pingback_IP = $this->getRealClientIP();
          if($Pingback_IP != "164.132.164.206")
          	 die("Invalid pingback IP");

    			$order = new WC_Order($_GET['view-order']);


          $dateCompleted = $order->get_date_completed();
          if(!empty($dateCompleted))
          	 echo 'Payment has already been completed for this order.';

          $currentStatus = $order->get_status();
          if($currentStatus == "Completed")
          	 die("TX already completed");
          if($currentStatus == "Failed")
          	 die("TX already failed");

          $d = stripslashes($_POST["data"]);
          $data = json_decode($d);

          if($data->secret != $this->secret) { //unknown secret
          	 die("Invalid secret key");
          }
          $note = "<b>" . $data->strState . "</b><br>Invoice #". $data->invoicename . "<br><a href='https://bitcoinz.ph/tx/".$data->lasttx."'>" . $data->lasttx . "</a><br><br>";

          if($data->state == 5) { //success
            $order->payment_complete();
            $order->update_status("completed", $note);
          } else {
            $order->update_status("failed", $note);
          }
        }



    } // end class WC_Gateway_Btcz





}





add_action( 'woocommerce_thankyou', 'callback_handler' );
add_action( 'woocommerce_view_order', 'view_order_custom' );

function view_order_custom($order_id) {

  $order = new WC_Order($order_id);

  $APIUrl = 'https://pay.btcz.app/api/check_payment';
  $ch = curl_init();
  curl_setopt_array($ch, array(
      CURLOPT_URL => "$APIUrl/" . $order->get_transaction_id($this),
      CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
      CURLOPT_CUSTOMREQUEST => "GET",
      CURLOPT_HTTPHEADER => array(
          "cache-control: no-cache"
      ),
  ));

  //curl_setopt($ch, CURLOPT_URL, $url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_USERAGENT, "WP-Woo Plugin/0.1 ($MerchantEmail)");

  $result = curl_exec($ch);
  $info = curl_getinfo($ch);

  curl_close($ch);

  if($info['http_code'] != 200)
    return false;


    // Check if contains ''//localhost' - for test server -----------------------------------------------------------------------------------------------------
    if (strpos($order->get_checkout_order_received_url(), '//localhost') !== false && json_decode($result)->state==5 && $order->get_status() != 'completed') {
      $ch = curl_init();
      curl_setopt($ch, CURLOPT_URL, $order->get_checkout_order_received_url());
      curl_setopt($ch, CURLOPT_HEADER, false);
      curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
      curl_exec($ch);
      curl_close($ch);

      echo "Test server localhost just updated server API callback.</br>";
    }

  ?>
    <h2>Payment details</h2>

  <?php


  $InvoiceURL = "https://pay.btcz.app/invoice/" . $order->get_transaction_id($this);
  if (json_decode($result)->state==1){
    echo '<iframe id="iFrame" style="min-height: 785px" width="100%"  frameborder="0" src="'.$InvoiceURL.'" scrolling="no"></iframe>';
  } else if (json_decode($result)->state==0) {
    echo '<iframe id="iFrame" style="min-height: 420px" width="100%"  frameborder="0" src="'.$InvoiceURL.'" scrolling="no"></iframe>';
  } else {
    echo '<iframe id="iFrame" style="min-height: 400px" width="100%"  frameborder="0" src="'.$InvoiceURL.'" scrolling="no"></iframe>';
  }


}

function callback_handler($order_id) {



  $order = new WC_Order($order_id);




  $APIUrl = 'https://pay.btcz.app/api/check_payment';
  // https://pay.btcz.app/api/check_payment/:_id


  $ch = curl_init();
  curl_setopt_array($ch, array(
      CURLOPT_URL => "$APIUrl/" . $order->get_transaction_id($this),
      CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
      CURLOPT_CUSTOMREQUEST => "GET",
      CURLOPT_HTTPHEADER => array(
          "cache-control: no-cache"
      ),
  ));

  //curl_setopt($ch, CURLOPT_URL, $url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_USERAGENT, "WP-Woo Plugin/0.1 ($MerchantEmail)");

  $result = curl_exec($ch);
  $info = curl_getinfo($ch);

  curl_close($ch);

  if($info['http_code'] != 200)
    return false;



    ?>
      <h2>Payment details</h2>

    <?php

    $InvoiceURL = "https://pay.btcz.app/invoice/" . $order->get_transaction_id($this);
    echo '<iframe id="iFrame" style="min-height: 400px" width="100%"  frameborder="0" src="'.$InvoiceURL.'" scrolling="no"></iframe>';





    $order->add_order_note("Gateway API information: " . $result);
    $order->update_status( 'completed');
    $order->save();

}
