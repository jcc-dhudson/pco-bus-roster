$('#alertBtn').click(function () {
    $('#menuModal').modal('show')
})
$('#nav-checkin').click(function(){
    window.location.href = '/';
})
$('#nav-writeTags').click(function(){
    window.location.href = '/write';
})
$('#nav-viewEvents').click(function(){
    window.location.href = '/eventview';
})
$('#nav-myGroup').click(function(){
    window.location.href = '/mygroup';
})
$('#nav-restart').click(function(){
    $.get("/list?refresh=true", function(data, status){
            $table.bootstrapTable('load', data)
    });
    $('#menuModal').modal('hide')
})