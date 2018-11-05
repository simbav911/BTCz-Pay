<div class="row thickpad">
   <div class="medium-12 small-12 columns">
		<iframe  id="iFrame" width="100%" style="min-height: 800px" frameborder="0" src="{$module.BTCz_InvoiceURL}" scrolling="no" onload="resizeIframe()" ></iframe>
   </div>
</div>
{literal}
<style>
@media only screen and (max-width: 853px) {
    #iFrame {
        height: 830px;
    }
}
@media only screen and (max-width: 777px) {
    #iFrame {
        height: 890px;
    }
}
@media only screen and (max-width: 540px) {
    #iFrame {
        height: 930px;
    }
}
@media only screen and (max-width: 475px) {
    #iFrame {
        height: 980px;
    }
}
@media only screen and (max-width: 426px) {
    #iFrame {
        height: 1020px;
    }
}
</style>
<script type="text/javascript">
  window.onload = function() {
    var i =document.getElementsByTagName("input");
    for( var n in i){
      if (i[n].value==="Make Payment"){
        i[n].style.visibility = "hidden";
      }
    }
  };
</script>
<script type="text/javascript">
  window.addEventListener('message', function(event) {
      if (~event.origin.indexOf('pay.btcz.app')) {
          setTimeout(function() {
            window.top.location.href = event.data;
          }, 3000);
      }
  });
</script>
<script type="text/javascript">
  function resizeIframe() {
  	var obj = document.getElementById("iFrame");
  	obj.style.height = (obj.contentWindow.document.body.scrollHeight) + 'px';
  	setTimeout('resizeIframe()', 200);
  }
</script>
{/literal}
