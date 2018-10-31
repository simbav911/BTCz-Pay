<?php
class Gateway {
	private $_config;
	private $_module;
	private $_basket;
	private $_APIUrl;
	
	public function __construct($module = false, $basket = false) {
		$this->_db		=& $GLOBALS['db'];
		$this->_module	= $module;
		$this->_basket =& $GLOBALS['cart']->basket;
		$this->_APIUrl = 'https://btcz.in/api/process';
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

    public function QueryGateway($url_id, $secret)
    { 
        $fields = array(
                'f' => "getinfo",
                'id' => urlencode($url_id),
                'p_secret' => urlencode($secret)	
        );
				
        $fields_string = "";
        foreach($fields as $key=>$value) { $fields_string .= $key.'='.$value.'&'; }
        rtrim($fields_string, '&');

        $ch = curl_init();
        curl_setopt($ch,CURLOPT_URL, $this->_APIUrl);
        curl_setopt($ch,CURLOPT_POST, count($fields));
        curl_setopt($ch,CURLOPT_POSTFIELDS, $fields_string);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true );
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true );
			
        $result = curl_exec($ch);
        $response = curl_getinfo( $ch );
        curl_close($ch);
		
        if($response['http_code'] != 200)
            return false;
		
        return $result;
	}	
	
    public function CreateGateway($MerchantAddress, $ReturnURL, $MerchantEmail, $InvoiceID, $Amount, $Expire, $Secret, $CurrencyCode)
    { 
        $fields = array(
                'f' => "create",
                'p_addr' => urlencode($MerchantAddress),
                'p_invoicename' => urlencode($InvoiceID),
                'p_email' => urlencode($MerchantEmail),
                'p_secret' => urlencode($Secret),
                'p_expire' => urlencode($Expire),
		'p_success_url' => urlencode($ReturnURL),
		'p_currency_code' => urlencode($CurrencyCode),
		'p_amount' => urlencode($Amount)		
        );
			
        $fields_string = "";
        foreach($fields as $key=>$value) { $fields_string .= $key.'='.$value.'&'; }
        rtrim($fields_string, '&');
		
        $ch = curl_init();
        curl_setopt($ch,CURLOPT_URL, $this->_APIUrl);
        curl_setopt($ch,CURLOPT_POST, count($fields));
        curl_setopt($ch,CURLOPT_POSTFIELDS, $fields_string);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true );
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true );
			
        $result = curl_exec($ch);
        $response = curl_getinfo( $ch );
        curl_close($ch);
		
        if($response['http_code'] != 200)
            return false;
		
        return $result;
    }

	public function form() {
		$InvoiceSessionKey = 'BTCz_UrlID'.$this->_basket['cart_order_id'].$this->_basket['total'];
		
		if (isset($_SESSION[$InvoiceSessionKey])) //our gateway has finished, lets check the data
		{
			$Resp = $this->QueryGateway($_SESSION[$InvoiceSessionKey], $this->_module['sk_live']);
			$JSON_RESP = json_decode($Resp);
			
			if(!empty($JSON_RESP) && isset($JSON_RESP->state))
			{
				 if($JSON_RESP->state == 5 || $JSON_RESP->state == 4) //success
				 {
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
					
					unset($_SESSION[$InvoiceSessionKey]);
					
					httpredir(currentPage(array('_g', 'type', 'cmd', 'module'), array('_a' => 'complete')));
				 } 
				 else if($JSON_RESP->state == 2) //timeout
				 {
					$order				= Order::getInstance();
					$cart_order_id 		= $this->_basket['cart_order_id'];
					$order_summary		= $order->getSummary($cart_order_id);
					
					$order->orderStatus(Order::PAYMENT_DECLINE, $cart_order_id);
					$order->paymentStatus(Order::ORDER_CANCELLED, $cart_order_id);
					
					unset($_SESSION[$InvoiceSessionKey]);
					
					httpredir(currentPage(array('_g', 'type', 'cmd', 'module'), array('_a' => 'complete')));
				 }			 
			}
		}
	
		if(empty($JSON_RESP))
		{
			$current_currency_code = ($GLOBALS['session']->has('currency', 'client')) ? $GLOBALS['session']->get('currency', 'client') : $GLOBALS['config']->get('config', 'default_currency');
			$ReturnURL = CC_STORE_URL."/?_a=gateway&gateway=Bitcoinz";
			$RESP =  $this->CreateGateway($this->_module['address'], $ReturnURL, $this->_module['email'], $this->_basket['cart_order_id'], $this->_basket['total'], 15,  $this->_module['sk_live'], $current_currency_code);
			$JSON_RESP = json_decode($RESP);
		}
		
		if(!empty($JSON_RESP))
		{
			$_SESSION[$InvoiceSessionKey] = $JSON_RESP->url_id;
			$this->_module['BTCz_InvoiceURL'] = "https://btcz.in/invoice?id=".$JSON_RESP->url_id;
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
}
