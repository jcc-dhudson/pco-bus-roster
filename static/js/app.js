
var $table = $('#fresh-table')
var $alertBtn = $('#alertBtn')

window.operateEvents = {
    'click .checkin': function (e, value, row, index) {
        
      alert('You click like icon, row: ' + JSON.stringify(row))

      console.log(value, row, index)
    },
    'click .edit': function (e, value, row, index) {
      alert('You click edit icon, row: ' + JSON.stringify(row))
      console.log(value, row, index)
    },
    'click .remove': function (e, value, row, index) {
      $table.bootstrapTable('remove', {
        field: 'id',
        values: [row.id]
      })
    }
  }

  function actionFormatter(value, row, index) {
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