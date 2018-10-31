Cubecart BTCz Plugin (beta v0.1.0)
===================


Install
---------
Download Zip File:
https://github.com/MarcelusCH/BTCz-Pay/raw/master/plugin/cubecart6/Cubecart-BTCz-0.1.zip

Unzip the content in your Cubecart root folder (ubuntu 16.04):
```
sudo rm -R /var/www/html/cubecart/modules/gateway/BitcoinZ/
sudo unzip Cubecart-BTCz-0.1.zip -d /var/www/html/cubecart/
```

Change owner of the `BitcoinZ/` folder:
```
sudo chown -R www-data:www-data /var/www/html/cubecart/modules/gateway/BitcoinZ/
```

Log into your Cubecart admin panel, goto "Extensions->Manage extensions" and activate "Bitcoinz Payment Gateway" plugin:
![](https://github.com/MarcelusCH/BTCz-Pay/raw/master/plugin/cubecart6/img/Cubecart-ManageExtensions.png)

Clic on the "edit" button, change the "Secret key" and the "BTCz Merchand Address", clic save:
![](https://github.com/MarcelusCH/BTCz-Pay/raw/master/plugin/cubecart6/img/Cubecart-ManagePlugin.png)

Usage example
----------------

Checkout:
![](https://github.com/MarcelusCH/BTCz-Pay/raw/master/plugin/cubecart6/img/Cubecart1.png)

Accept:
![](https://github.com/MarcelusCH/BTCz-Pay/raw/master/plugin/cubecart6/img/Cubecart2.png)

Pay:
![](https://github.com/MarcelusCH/BTCz-Pay/raw/master/plugin/cubecart6/img/Cubecart3.png)

Done:
![](https://github.com/MarcelusCH/BTCz-Pay/raw/master/plugin/cubecart6/img/Cubecart4.png)

Admin automatique notes:
![](https://github.com/MarcelusCH/BTCz-Pay/raw/master/plugin/cubecart6/img/Cubecart5.png)


**That is it!**
