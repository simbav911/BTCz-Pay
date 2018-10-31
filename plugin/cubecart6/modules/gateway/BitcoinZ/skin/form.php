<div class="row thickpad">
   <div class="medium-12 small-12 columns">
		<iframe id="iFrame" width="100%" style="min-height: 800px" frameborder="0" src="{$module.BTCz_InvoiceURL}" scrolling="no" onload="resizeIframe()"></iframe>
   </div>
</div>
{literal}
<script type="text/javascript">
$(document).ready(function() {
  for (let el of document.querySelectorAll('.success')) el.style.visibility = 'hidden';
});
function resizeIframe() {
	var obj = document.getElementById("iFrame");
	obj.style.height = (obj.contentWindow.document.body.scrollHeight) + 'px';
	setTimeout('resizeIframe()', 200);
}
</script>
{/literal}
