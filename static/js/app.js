
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
  zoom: 14,
});
var map = new ol.Map({
  target: 'map',
  layers: [ new ol.layer.Tile({ 
    source: new ol.source.OSM(),
    attributions: [ '' ],
  }) ],
  view: mapView
})
if( 'NDEFReader' in window){
  const ndef = new NDEFReader();
  ndef.scan().then(() => {
    console.log("Scan started successfully.");
    ndef.onreadingerror = () => {
      console.log("Cannot read data from the NFC tag. Try another one?");
    };
    ndef.onreading = event => {
      const message = event.message;
      for (const record of message.records) {
        console.log(record)
        // postCheckin(record.message)
      }
    };
  }).catch(error => {
    console.log(`Error! Scan failed to start: ${error}.`);
  });
} else {
  console.log('no NDEFReader available, not scanning NFC')
}


//
// when the check-in button is clicked
//
function postCheckin(pID) {
  navigator.geolocation.getCurrentPosition((gpsLoc) => {
    userLocation = {
      'latitude': gpsLoc.coords.latitude,
      'longitude': gpsLoc.coords.longitude,
      'accuracy': gpsLoc.coords.accuracy,
      'heading': gpsLoc.coords.heading,
      'speed': gpsLoc.coords.speed
    }
    row = $table.bootstrapTable('getRowByUniqueId', pID)
    if(row.id != undefined) {
      postObj = {'id': row.id, 'name': row.name, 'location': userLocation}
      $.ajax('/checkin', {
        data : JSON.stringify(postObj),
        contentType : 'application/json',
        type : 'POST',
      })
    } else {
      console.log("could not find row by ", pID)
    }
  }, (error) => {
    userLocation = {
      'latitude': 0,
      'longitude': 0,
      'accuracy': 9999,
      'heading': 0,
      'speed': 0
    }
    row = $table.bootstrapTable('getRowByUniqueId', pID)
    if(row.id != undefined) {
      postObj = {'id': row.id, 'name': row.name, 'location': userLocation}
      $.ajax('/checkin', {
        data : JSON.stringify(postObj),
        contentType : 'application/json',
        type : 'POST',
      })
    } else {
      console.log("could not find row by ", pID)
    }
  }, {enableHighAccuracy: true});
}
window.operateEvents = {
  'click .checkin': function (e, value, row, index) {
    $table.bootstrapTable('updateByUniqueId', {
      id: row.id,
      row: {
        actions: 'blank'
      }})
      postCheckin(row.id)
      console.log(row.id)
  }
}
  //
  // when a check-in status message is clicked:
  //
window.operateStatus = {
  'click .status': function (e, value, row, index) {
    //$('#omnimodal-body').html('')
    $('#omnimodal-title').html(row.name + ' @ ' + row.status)
    mapView.centerOn(ol.proj.fromLonLat([row.location.longitude, row.location.latitude]), map.getSize(), [640, 640])
    map.addLayer(
      pointLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: [
                new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([row.location.longitude, row.location.latitude]))
                })
            ]
        })
      })
    );
    $('#omnimodal').modal('show')
  }
}

$('#omnimodal').on('shown.bs.modal', event => {
  map.updateSize();
})

//
// table formatters
//
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
    if( 'location' in row && row.location.latitude != 0 ) {
      return '<a class="table-action status" href="javascript:void(0)">'+ value + '</a>'
    } else {
      return value
    }
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
    uniqueId: "id"
  })
})

$alertBtn.click(function () {
  $.get("/list?refresh=true", function(data, status){
      $table.bootstrapTable('load', data)
  });
})


var ws
$.get("/negotiate", function(data, status){
  ws = new WebSocket(data.url, protocols='json.webpubsub.azure.v1');
  ws.onmessage = event => {
    data = JSON.parse(event.data);
    console.log(data.data)
    if (data.type == "message") {
      if( 'person_id' in data.data ) {
        console.log( data.data.person_id + ' ' + data.data.status )
        $table.bootstrapTable('updateByUniqueId', {
          id: data.data.person_id,
          row: {
            status: data.data.status,
            location: data.data.location,
            detail: JSON.stringify(data.data.location)
          }})
      } else if ( 'refresh' in  data.data && data.data.refresh == true){
        $.get("/list", function(data, status){
          $table.bootstrapTable('load', data)
        });
      }
    }
  };
});