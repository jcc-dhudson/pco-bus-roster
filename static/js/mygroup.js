var $table = $('#fresh-table')
var myGroupMembers = []

    //
    // when a check-in status message is clicked:
    //
window.addMember = {
'click .addremove': function (e, value, row, index) {
    if(row.inMyGroup) {
        myGroupMembers = arrayRemove(myGroupMembers, row.id)
        $table.bootstrapTable('updateByUniqueId', {
            id: row.id,
            row: {
              inMyGroup: false
            }
        })
        $.ajax('/groups', {
            data : JSON.stringify({'members': myGroupMembers}),
            contentType : 'application/json',
            type : 'POST',
        })
    } else {
        myGroupMembers.push(row.id)
        myGroupMembers = uniq(myGroupMembers)
        console.log(myGroupMembers)
        $table.bootstrapTable('updateByUniqueId', {
            id: row.id,
            row: {
              inMyGroup: true
            }
        })
        $.ajax('/groups', {
            data : JSON.stringify({'members': myGroupMembers}),
            contentType : 'application/json',
            type : 'POST',
        })
    }
    
}
}

//
// table formatters
//
function actionFormatter(value, row, index) {
    if(! row.inMyGroup) {
      return [
        '<a rel="tooltip" title="Checkin" class="table-action addremove" href="javascript:void(0)" title="Like">',
          '<i style="font-size: 60px" class="fa-solid fa-circle-plus"></i>',
        '</a>'
      ].join('')
    }
    return [
        '<a rel="tooltip" title="Checkin" class="table-action addremove" href="javascript:void(0)" title="Like">',
          '<i style="font-size: 60px" class="fa-solid fa-check"></i>',
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
      onPostBody: loadData()
    })
  })

function loadData() {
    $.get("/list?noStatus=true", function(data, status){
        $table.bootstrapTable('load', data)
        loadGroups()
      });
}
function loadGroups() {
    $.get("/groups", function(data, status){
        console.log(data.members)
        myGroupMembers = data.members
        data.members.forEach(function(m){
            $table.bootstrapTable('updateByUniqueId', {
                id: m,
                row: {
                    inMyGroup: true,
                }
            })
        })
    });
    
}


function uniq(a) {
    var prims = {"boolean":{}, "number":{}, "string":{}}, objs = [];

    return a.filter(function(item) {
        var type = typeof item;
        if(type in prims)
            return prims[type].hasOwnProperty(item) ? false : (prims[type][item] = true);
        else
            return objs.indexOf(item) >= 0 ? false : objs.push(item);
    });
}
function arrayRemove(arr, value) { 
    return arr.filter(function(ele){ 
        return ele != value; 
    });
}
