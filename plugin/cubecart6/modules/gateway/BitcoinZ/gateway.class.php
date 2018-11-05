<?php
class Gateway {
	private $_config;
	private $_module;
	private $_basket;
	private $_APIUrlcreate;
	private $_APIUrlquery;

	public function __construct($module = false, $basket = false) {
		$this->_db		=& $GLOBALS['db'];
		$this->_module	= $module;
		$this->_basket =& $GLOBALS['cart']->basket;
		$this->_APIUrlcreate = 'https://pay.btcz.app/api/request_payment';
		$this->_APIUrlquery = 'https://pay.btcz.app/api/check_payment';
	}

	public function transfer() {
		$transfer	= array(
			'action'	=> currentPage(),
			'method'	=> 'post',
			'target'	=> '_self',
			'submit'	=> 'manual'
		);
		return $transfer;
	}

	public function QueryGateway($url_id) {

		$ch = curl_init();
		curl_setopt_array($ch, array(
				CURLOPT_URL => $this->_APIUrlquery . "/" . $url_id,
				CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
				CURLOPT_CUSTOMREQUEST => "GET",
				CURLOPT_HTTPHEADER => array(
						"cache-control: no-cache"
				),
		));
		//curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_USERAGENT, "Cubecart Plugin/0.1.3 ($MerchantEmail)");
		$result = curl_exec($ch);
		$info = curl_getinfo($ch);
		curl_close($ch);


		if($info['http_code'] != 200)
			return false;

		return $result;

	}

	public function CreateGateway($MerchantAddress, $ReturnURL, $MerchantEmail, $InvoiceID, $Amount, $Expire, $Secret, $CurrencyCode) {

							$ipnPingback = CC_STORE_URL."/?_g=rm&type=gateway&cmd=call&module=BitcoinZ&order_id=".$this->_basket['cart_order_id'];
		          $query = urlencode(urlencode($ipnPingback))  . "/" . urlencode(urlencode($ReturnURL)). "/" . urlencode(urlencode($ReturnURL));
		          $ch = curl_init();
		          curl_setopt_array($ch, array(
		              CURLOPT_URL => $this->_APIUrlcreate . "/" . urlencode($Amount) . "/" . urlencode($CurrencyCode)  . "/na/" . urlencode($MerchantAddress) . "/" . urlencode($MerchantEmail) . "/" . $query . "/0/" . $Secret,
		              CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
		              CURLOPT_CUSTOMREQUEST => "GET",
		              CURLOPT_HTTPHEADER => array(
		                  "cache-control: no-cache"
		              ),
		          ));
		          //curl_setopt($ch, CURLOPT_URL, $url);
		          curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		          curl_setopt($ch, CURLOPT_USERAGENT, "Cubecart Plugin/0.1.3 ($MerchantEmail)");
		          $result = curl_exec($ch);
		          $info = curl_getinfo($ch);
							curl_close($ch);


        if($info['http_code'] != 200)
            return false;


        return $result;
	}

	public function form() {
		$InvoiceSessionKey = 'BTCz_UrlID'.$this->_basket['cart_order_id'].$this->_basket['total'];



		if (isset($_SESSION[$InvoiceSessionKey])) {
			$Resp = $this->QueryGateway($_SESSION[$InvoiceSessionKey]);
			$JSON_RESP = json_decode($Resp);


			if(!empty($JSON_RESP) && isset($JSON_RESP->state)) {
				 if($JSON_RESP->state == 5 || $JSON_RESP->state == 4) { //success

					$order				= Order::getInstance();
					$cart_order_id 		= $this->_basket['cart_order_id'];
					$order_summary		= $order->getSummary($cart_order_id);

					$status = "Completed";

					$order->orderStatus(Order::ORDER_PROCESS, $cart_order_id);
					$order->paymentStatus(Order::PAYMENT_SUCCESS, $cart_order_id);

					$transData['notes']			= implode(' ', $notes);
					$transData['order_id']		= $cart_order_id;
					$transData['amount']		= $this->_basket['total'];
					$transData['status']		= $status;
					$transData['customer_id']	= $order_summary['customer_id'];
					$transData['gateway']		= 'Bitcoinz';
					$order->logTransaction($transData);

					$TestNote =  $this->CreateNote($this->_basket['cart_order_id'],"Gateway paid : https://pay.btcz.app/invoice/".$_SESSION[$InvoiceSessionKey]);

					unset($_SESSION[$InvoiceSessionKey]);

					httpredir(currentPage(array('_g', 'type', 'cmd', 'module'), array('_a' => 'complete')));
				 }
				 else if($JSON_RESP->state == 2) { //timeout

					$order				= Order::getInstance();
					$cart_order_id 		= $this->_basket['cart_order_id'];
					$order_summary		= $order->getSummary($cart_order_id);

					$order->orderStatus(Order::PAYMENT_DECLINE, $cart_order_id);
					$order->paymentStatus(Order::ORDER_CANCELLED, $cart_order_id);

					$TestNote =  $this->CreateNote($this->_basket['cart_order_id'],"Gateway expired : https://pay.btcz.app/invoice/".$_SESSION[$InvoiceSessionKey]);

					unset($_SESSION[$InvoiceSessionKey]);

					httpredir(currentPage(array('_g', 'type', 'cmd', 'module'), array('_a' => 'complete')));
				 }
			}
		}


		// Create the gateway
		if(empty($JSON_RESP)) {
			$current_currency_code = $GLOBALS['config']->get('config', 'default_currency'); // ($GLOBALS['session']->has('currency', 'client')) ? $GLOBALS['session']->get('currency', 'client') : $GLOBALS['config']->get('config', 'default_currency');
			$ReturnURL = CC_STORE_URL."/?_a=complete";
			//"/?_a=gateway";
			//"/?_a=vieworder&cart_order_id=".$this->_basket['cart_order_id'];


			$RESP =  $this->CreateGateway($this->_module['address'], $ReturnURL, $this->_module['email'], $this->_basket['cart_order_id'], $this->_basket['total'], 15,  $this->_module['sk_live'], $current_currency_code);
			$JSON_RESP = json_decode($RESP);
			$_SESSION[$InvoiceSessionKey] = $JSON_RESP->id;
			$TestNote =  $this->CreateNote($this->_basket['cart_order_id'],"New Gateway : https://pay.btcz.app/invoice/".$_SESSION[$InvoiceSessionKey]);
		}


		if(!empty($JSON_RESP)) {

			$this->_module['BTCz_InvoiceURL'] = "https://pay.btcz.app/invoice/".$_SESSION[$InvoiceSessionKey];
		}
		else if(strlen($RESP)) $GLOBALS['gui']->setError($RESP);
		else $GLOBALS['gui']->setError("Error: No response from API"); //Unknown error

		$GLOBALS['smarty']->assign('CUSTOMER', $this->_basket['billing_address']);
		$GLOBALS['smarty']->assign('module', $this->_module);




		## Check for custom template for module in skin folder
		$file_name = 'form.php';
		$form_file = $GLOBALS['gui']->getCustomModuleSkin('gateway', dirname(__FILE__), $file_name);
		$GLOBALS['gui']->changeTemplateDir($form_file);
		$ret = $GLOBALS['smarty']->fetch($file_name);
		$GLOBALS['gui']->changeTemplateDir();
		return $ret;

	}



	public function CreateNote($order_id = null, $note = null) {

		if (!empty($order_id) && !empty($note)) {

			$record	= array(
				'cart_order_id'	=> $order_id,
				'time'			=> time(),
				'content'		=> $note
			);
		 	// Check for duplicates...
		 	if($GLOBALS['db']->select('CubeCart_order_notes','note_id',array('cart_order_id' => $order_id, 'content' => $note))) {
		 		return false;
		 	}
			return (bool)$GLOBALS['db']->insert('CubeCart_order_notes', $record);
		}
		return false;
	}


	// IPN Call (gateway pingback)
	public function call() {
		$cart_order_id=$_GET['order_id'];
		if ($this->_module['sk_live']==$_GET['secret']) {
			if ($_GET['state']=='2') {
				$order = Order::getInstance();
				$order->orderStatus(Order::PAYMENT_DECLINE, $cart_order_id);
				$order->paymentStatus(Order::ORDER_CANCELLED, $cart_order_id);
				$TestNote =  $this->CreateNote($cart_order_id ,"Gateway Pingback expired.");
			} else if ($_GET['state']=='5'){
				$order = Order::getInstance();
				$order->orderStatus(Order::ORDER_PROCESS, $cart_order_id);
				$order->paymentStatus(Order::PAYMENT_SUCCESS, $cart_order_id);
				$transData['notes']			= implode(' ', $notes);
				$transData['order_id']		= $cart_order_id;
				$transData['status']		= "Completed";
				$transData['gateway']		= 'Bitcoinz';
				$order->logTransaction($transData);
				$TestNote =  $this->CreateNote($cart_order_id ,"Gateway Pingback success.");
			}
		}
	}


}
