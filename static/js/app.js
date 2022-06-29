
var $table = $('#fresh-table')
var $alertBtn = $('#alertBtn')
var userLocation = {}
const options = {
  timeZone:"US/Eastern",
  hour12 : false,
  hour:  "2-digit",
  minute: "2-digit",
  second: "2-digit"
};
const mapView = new ol.View({
  center: [0, 0],
  zoom: 16,
});
var map = new ol.Map({
  target: 'map',
  layers: [ new ol.layer.Tile({ source: new ol.source.OSM() }) ],
  view: mapView
})

console.log(map)


navigator.geolocation.getCurrentPosition((gpsLoc) => {
  userLocation.latitude = gpsLoc.coords.latitude
  userLocation.longitude = gpsLoc.coords.longitude
  userLocation.accuracy = gpsLoc.coords.accuracy
  userLocation.heading = gpsLoc.coords.heading
  userLocation.speed = gpsLoc.coords.speed
}, null, {enableHighAccuracy: true});

window.operateEvents = {
    'click .checkin': function (e, value, row, index) {
      $table.bootstrapTable('updateByUniqueId', {
        id: row.id,
        row: {
          actions: 'blank'
        }})
        navigator.geolocation.getCurrentPosition((gpsLoc) => {
          userLocation.latitude = gpsLoc.coords.latitude
          userLocation.longitude = gpsLoc.coords.longitude
          userLocation.accuracy = gpsLoc.coords.accuracy
          userLocation.heading = gpsLoc.coords.heading
          userLocation.speed = gpsLoc.coords.speed
          postObj = {'id': row.id, 'name': row.name, 'location': userLocation}
          $.ajax('/checkin', {
            data : JSON.stringify(postObj),
            contentType : 'application/json',
            type : 'POST',
          })
        }, null, {enableHighAccuracy: true});
        
        
    }
  }
  window.operateStatus = {
    'click .status': function (e, value, row, index) {
      //$('#omnimodal-body').html('')
      $('#omnimodal-title').html(row.name + ' @ ' + row.status)
      mapView.centerOn(ol.proj.fromLonLat([row.location.longitude, row.location.latitude]), map.getSize(), [570, 500])
      $('#omnimodal').modal('show')
    }
  }
  $('#omnimodal').on('shown.bs.modal', event => {
    map.updateSize();
  })

function actionFormatter(value, row, index) {
  if(value == 'blank'){
    return ' '
  }
  if(row.status != undefined) {
    return ' '
  }
  return [
    '<a rel="tooltip" title="Checkin" class="table-action checkin" href="javascript:void(0)" title="Like">',
      '<i style="font-size: 60px" class="fa-solid fa-circle-check"></i>',
    '</a>'
  ].join('')
}
function statusFormatter(value, row, index) {
  if(value != undefined){
    return '<a class="table-action status" href="javascript:void(0)">'+ value + '</a>'
  }
}
function detailFormatter(value, row, index) {
  if(row.location != undefined) {
    return ''
  } else {
    return ''
  }
  
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
    detailFormatter: "detailFormatter",
    detailView: "true",
  })

  $alertBtn.click(function () {
    $.get("/list?refresh=true", function(data, status){
        $table.bootstrapTable('load', data)
    });
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
      console.log( data.data.person_id + ' ' + data.data.status )
      $table.bootstrapTable('updateByUniqueId', {
        id: data.data.person_id,
        row: {
          status: data.data.status,
          location: data.data.location,
          detail: JSON.stringify(data.data.location)
        }})
    }
  };
});