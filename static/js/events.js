
var $table = $('#fresh-table')
var sessions = {}
const options = {
  timeZone:"US/Eastern",
  hour12 : false,
  hour:  "2-digit",
  minute: "2-digit",
  second: "2-digit"
};
const mapView = new ol.View({
  zoom: 13,
});
var map = new ol.Map({
  target: 'map',
  layers: [ new ol.layer.Tile({ 
    source: new ol.source.OSM(),
    attributions: [ '' ],
  }) ],
  view: mapView
})



//
// when a check-in status message is clicked:
//
window.operateStatus = {
  'click .status': function (e, value, row, index) {
    $('#omnimodal-title').html(row.person_name + ' @ ' + row.status)
    $('#omnimodal-delete').data('delete-id', row.id)
    drawPoint(row.location.latitude, row.location.longitude, row.person_name)
    map.setSize([466, 400]);
    mapView.centerOn(ol.proj.fromLonLat([row.location.longitude, row.location.latitude]), map.getSize(), [233, 200])
    $('#omnimodal').modal('show')
  }
}
window.setSearch = {
  'click .setSearch': function (e, value, row, index){
    num = Math.round(Number(row.session))
    $table.bootstrapTable('resetSearch', num.toString(36))
  }
}

//
// table formatters
//
function statusFormatter(value, row, index) {
  if(value != undefined){
    if( 'location' in row && row.location.latitude != 0 ) {
      drawPoint(row.location.latitude, row.location.longitude, row.name)
      return '<a class="table-action status" href="javascript:void(0)">'+ value + '</a>'
    } else {
      return value
    }
  }
}
function locationFormatter(value, row, index) {
  if(row.location.latitude != undefined && row.location.latitude != 0){
    return '<a class="table-action status" href="javascript:void(0)"><i class="fa-solid fa-map-location-dot"></i></a>'
  } 
  return null
}
function timeFormatter(value, row, index) {
  var dt = new Date(value * 1000);
  return dt.toLocaleString('en-US')
}
function sessionFormatter(value, row, index) {
  num = Math.round(Number(value))
  return '<a class="table-action setSearch" href="javascript:void(0)">'+num.toString(36)+'</a>'
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
    sortName: "datetime",
    sortOrder: "desc",
  })
})







var ws
$.get("/negotiate", function(data, status){
  ws = new WebSocket(data.url, protocols='json.webpubsub.azure.v1');
  ws.onmessage = event => {
    data = JSON.parse(event.data);
    if (data.type == "message" && data.from == "server") {
      if( 'person_id' in data.data ) {
        console.log( data.data.person_id + ' ' + data.data.status )
        $table.bootstrapTable('updateByUniqueId', {
          id: data.data.person_id,
          row: {
            status: data.data.status,
            location: data.data.location,
            detail: JSON.stringify(data.data.location)
          }})
      } 
    }
  };
});





function drawPoint(latitude, longitude, label) {
  map.addLayer(
    pointLayer = new ol.layer.Vector({
      source: new ol.source.Vector({
          features: [
              new ol.Feature({
                  geometry: new ol.geom.Point(ol.proj.fromLonLat([longitude, latitude]))
              })
          ],
      })
    })
  );
  var textStyle = new ol.style.Style({
    text: new ol.style.Text({
        font: '12px Calibri,sans-serif',
        fill: new ol.style.Fill({
            color:'#000'
        }),
        stroke: new ol.style.Stroke({
            color:'#fff',
            width:3
        }),
        textAlign:'left',
        offsetX:2
    })
  });
  textStyle.getText().setText(label)
  map.addLayer(
    pointName = new ol.layer.Vector({
      source: new ol.source.Vector({
          features: [
            new ol.Feature({
              geometry: new ol.geom.Point(ol.proj.fromLonLat([longitude, latitude]))
          })
          ]
      }),
      visible: true,
      title: label,
      style: textStyle
    })
  )

}