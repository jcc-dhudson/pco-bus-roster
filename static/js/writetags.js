var $table = $('#fresh-table')
var completedByMe = []

window.operateEvents = {
    'click .checkin': function (e, value, row, index) {
        rowElem = $('*[data-uniqueid='+ row.id +']')
        $table.bootstrapTable('scrollTo', {unit: 'rows', value: rowElem.data('index')})
        $('#scanModal-title').html(
            '<h2>'+row.name+'</h2><br /><img src="'+row.avatar+'" style="width:100%"></img><span id="scanModal-msg"></span>'
        )
        $('#scanModal').modal('show')
        const ndef = new NDEFReader();
        ndef.write(
            row.id
        ).then(() => {
            console.log('written')
            ndef.scan().then(() => {
                console.log("Scan started successfully.");
                ndef.onreadingerror = () => {
                    $('#scanModal-msg').html('Write failed. Close this window and try again.')
                };
                ndef.onreading = event => {
                  for (const record of event.message.records) {
                    const textDecoder = new TextDecoder(record.encoding);
                    tagId = textDecoder.decode(record.data)
                    console.log(`Tag text: ${tagId}`);
                    if( textDecoder.decode(record.data) == row.id ){
                        if( ! completedByMe.includes(row.id) ) {
                            completedByMe.push(row.id)
                            $.ajax('/writetag', {
                                data : JSON.stringify({'tagsCompleted': completedByMe}),
                                contentType : 'application/json',
                                type : 'POST',
                            })
                        }
                        $('#scanModal').modal('hide')
                    } else {
                        $('#scanModal-msg').html('Write failed. Close this window and try again.')
                    }
                    
                  }
                };
              }).catch(error => {
                console.log(`Error! Scan failed to start: ${error}.`);
            });

            //window.location.reload()
        }).catch(error => {
            console.log(`Write failed. Try again: ${error}.`);
            $('#scanModal-msg').html(`Write failed :-( try again: ${error}.`)
        });
    }
  }
    //
    // when a check-in status message is clicked:
    //
  window.operateStatus = {
    'click .status': function (e, value, row, index) {
      //$('#omnimodal-body').html('')
      //$('#omnimodal-title').html(row.name + ' @ ' + row.status)
      //$('#omnimodal-delete').data('delete-id', row.id)
      //$('#omnimodal').modal('show')
    }
  }

//
// table formatters
//
function actionFormatter(value, row, index) {
    if(row.status === undefined || row.status === null) {
      return [
        '<a rel="tooltip" title="Checkin" class="table-action checkin" href="javascript:void(0)" title="Like">',
          '<i style="font-size: 60px" class="fa-solid fa-circle-arrow-down"></i>',
        '</a>'
      ].join('')
    }
    return ' '
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


var ws
$.get("/negotiate", function(data, status){
  ws = new WebSocket(data.url, protocols='json.webpubsub.azure.v1');
  ws.onmessage = event => {
    data = JSON.parse(event.data);
    console.log(data.data)
    if (data.type == "message" && data.data.channel == "tags") {

        if( 'tagsCompleted' in data.data ) {
            
            data.data.tagsCompleted.forEach(function(t){
                console.log(t)
                console.log('table', $table.bootstrapTable('getRowByUniqueId', t))
                $table.bootstrapTable('updateByUniqueId', {
                    id: t,
                    row: {
                        status: 'Tag written by ' + data.data.by_name
                    }
                })
            })
        }
    }
  };
});