
var $table = $('#fresh-table')
var $alertBtn = $('#alertBtn')

window.operateEvents = {
    'click .checkin': function (e, value, row, index) {
      $table.bootstrapTable('updateByUniqueId', {
        id: row.id,
        row: {
          actions: 'blank'
        }})
        $.get("/checkin/" + row.id, function(data, status){

        });
    }
  }

function actionFormatter(value, row, index) {
  if(value == 'blank'){
    return ' '
  }
  return [
    '<a rel="tooltip" title="Like" class="table-action checkin" href="javascript:void(0)" title="Like">',
      '<i style="font-size: 60px" class="fa-solid fa-circle-check"></i>',
    '</a>'
  ].join('')
}
function avatarFormatter(value, row, index) {
  return [
    '<img src="' + row.avatar + '" width="72px"/>'
  ].join('')
}


$(function () {
  $table.bootstrapTable({
    classes: 'table table-hover table-striped',
    toolbar: '.toolbar',

    search: true,
    pagination: false,
    striped: true,
    sortable: true,
    uniqueId: "id",

    formatShowingRows: function (pageFrom, pageTo, totalRows) {
      return ''
    },
    formatRecordsPerPage: function (pageNumber) {
      return pageNumber + ' rows visible'
    }
  })

  $alertBtn.click(function () {
    alert('You pressed on Alert')
  })
})

var ws
$.get("/negotiate", function(data, status){
  ws = new WebSocket(data.url, protocols='json.webpubsub.azure.v1');
  ws.onmessage = event => {
    data = JSON.parse(event.data);
    if (data.type === "ack") {
      var sentMessage = sentMessages[data.ackId];
      if (sentMessage) {
        if (data.success == true) {
          sentMessage.innerText += ' Success'
        } else {
          sentMessage.innerText += ` Failed: ${data.error.message}`
        }
      }
    } else if (data.type == "message") {
      //row = getRowByUniqueId(data.data.checkin)
      //$table.bootstrapTable('hideRow', {'uniqueId': data.data.checkin})
      //$table.bootstrapTable('hideColumn', 'name')
      $('*[data-uniqueid='+ data.data.checkin +']').css('opacity','0.3')
      //console.log(  )
      $table.bootstrapTable('updateByUniqueId', {
        id: row.id,
        row: {
          actions: 'blank'
        }})
    }
  };
});


