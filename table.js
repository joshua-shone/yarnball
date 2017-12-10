function createTable(baseNode, forwardNode) {
  var table = document.createElement('table');
  table.style.left = baseNode.style.left;
  table.style.top  = baseNode.style.top;
  graph.appendChild(table);
  table.downVia = forwardNode;
  var lastNode = null;
  for (var link of followListLinks(baseNode, forwardNode)) {
    var tr = document.createElement('tr');
    table.appendChild(tr);
    var td = document.createElement('td');
    tr.appendChild(td);
    td.tableElementNode = link.from;
    link.from.attachedTableCell = td;
    td.attachedDownLink = link;
    td.attachedDownViaNode = link.via;
    td.attachedNodes = new Set([link.from]);
    lastNode = link.to;
  }
  var tr = document.createElement('tr');
  table.appendChild(tr);
  var td = document.createElement('td');
  tr.appendChild(td);
  td.tableElementNode = lastNode;
  lastNode.attachedTableCell = td;
  td.attachedNodes = new Set([lastNode]);

  Array.from(table.getElementsByTagName('TD')).forEach(td => {
    td.tableElementNode.style.top  = (table.offsetTop  + td.offsetTop  + 45) + 'px';
    td.tableElementNode.style.left = (table.offsetLeft + td.offsetLeft + 45) + 'px';
    if (td.attachedDownLink) {
      td.attachedDownLink.classList.add('hidden');
      td.attachedDownLink.via.classList.add('hidden');
    }
  });
  fitTableCellsToAttachedNodes(table);
  return table;
}

function handleTableMousedown(event) {
  event.preventDefault();
  var table = event.target;
  handleMouseDrag(event, {
    mousemove: function (cursor) {
      table.style.left = (parseFloat(table.style.left) + cursor.delta.x) + 'px';
      table.style.top  = (parseFloat(table.style.top)  + cursor.delta.y) + 'px';
      var affectedLinks = new Set();
      Array.from(table.getElementsByTagName('TD')).forEach(td => {
        td.attachedNodes.forEach(node => {
          node.style.left = (parseFloat(node.style.left) + cursor.delta.x) + 'px';
          node.style.top  = (parseFloat(node.style.top)  + cursor.delta.y) + 'px';
          node.links.forEach(link => affectedLinks.add(link));
        });
      });
      affectedLinks.forEach(layoutLink);
    },
  });
  return false;
}

function fitTableCellsToAttachedNodes(table) {
  var affectedLinks = new Set();
  Array.from(table.getElementsByTagName('TD')).forEach(td => {
    td.tableElementNode.style.top  = (table.offsetTop  + td.offsetTop  + 45) + 'px';
    td.tableElementNode.style.left = (table.offsetLeft + td.offsetLeft + 45) + 'px';
    td.tableElementNode.links.forEach(link => affectedLinks.add(link));
    var tdWidth  = 40;
    var tdHeight = 40;
    td.attachedNodes.forEach(node => {
      var tdWidthRequired = (node.offsetLeft - (table.offsetLeft + td.offsetLeft)) + node.offsetWidth + 20;
      if (tdWidthRequired > tdWidth) {
        tdWidth = tdWidthRequired;
      }
      var tdHeightRequired = (node.offsetTop - (table.offsetTop + td.offsetTop)) + node.offsetHeight + 20;
      if (tdHeightRequired > tdHeight) {
        tdHeight = tdHeightRequired;
      }
    });
    td.style.width  = tdWidth + 'px';
    td.style.height = tdHeight + 'px';
  });
  affectedLinks.forEach(layoutLink);
}

function isTableElementNode(node) {
  return node.attachedTableCell && node.attachedTableCell.tableElementNode === node;
}

function focusNextTableElementNode(node) {
  var tr = node.attachedTableCell.parentElement;
  if (tr.nextElementSibling) {
    Array.from(document.getElementsByClassName('selected')).forEach(element => element.classList.remove('selected'));
    var nextTableNode = tr.nextElementSibling.getElementsByTagName('TD')[0].tableElementNode;
    nextTableNode.focus();
    nextTableNode.classList.add('selected');
  }
}

function focusPreviousTableElementNode(node) {
  var tr = node.attachedTableCell.parentElement;
  if (tr.previousElementSibling) {
    Array.from(document.getElementsByClassName('selected')).forEach(element => element.classList.remove('selected'));
    var previousTableNode = tr.previousElementSibling.getElementsByTagName('TD')[0].tableElementNode;
    previousTableNode.focus();
    previousTableNode.classList.add('selected');
  }
}

function getTableNodes(table) {
  return Array.from(table.getElementsByTagName('TR')).map(tr => tr.getElementsByTagName('TD')[0].tableElementNode);
}

function rebuildTable(table, nodes) {
  var trs = Array.from(table.getElementsByTagName('TR'));
  var oldTrPositions = new Map();
  trs.forEach(tr => oldTrPositions.set(tr, tr.offsetTop));
  trs.forEach(tr => tr.remove());

  var affectedLinks = new Set();
  nodes.forEach(node => {
    if (node.attachedTableCell) {
      var tr = node.attachedTableCell.parentElement;
      table.appendChild(tr)
      var trDeltaY = oldTrPositions.get(tr) - tr.offsetTop;
      node.attachedTableCell.attachedNodes.forEach(attachedNode => {
        attachedNode.style.top = (parseFloat(attachedNode.style.top) - trDeltaY) + 'px';
        attachedNode.links.forEach(link => affectedLinks.add(link));
      });
    } else {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      tr.appendChild(td);
      node.attachedTableCell = td;
      td.tableElementNode = node;
      td.attachedNodes = new Set([node]);
      tr.style.width  = '90px';
      tr.style.height = '90px';
      table.appendChild(tr);
      node.style.left = (table.offsetLeft + 45) + 'px';
      node.style.top = (table.offsetTop + tr.offsetTop + 45) + 'px';
    }
  });
  affectedLinks.forEach(layoutLink);

  var downViaText = table.downVia.textContent;
  var downViaInstances = table.downVia.instances;

  var previousNode = null;
  nodes.forEach(node => {
    Array.from(node.links).forEach(link => {
      if (link.via.instances.has(table.downVia)) {
        deleteElements([link, link.via]);
        if (table.downVia === link.via) {
          table.downVia = null;
          downViaInstances.delete(link.via);
        }
      }
    });
    if (previousNode) {
      var via = createNode({x: 0, y: 0}, downViaText);
      via.instances = downViaInstances;
      via.instances.add(via);
      if (!table.downVia) table.downVia = via;
      var link = createLink({from: previousNode, via: via, to: node});
      via.classList.add('hidden');
      link.classList.add('hidden');
    }
    previousNode = node;
  });
}

function handleKeydownForTable(event) {
  if (event.key === 'Enter' && event.ctrlKey) {
    if (document.activeElement && document.activeElement.classList.contains('node') && document.activeElement.attachedTableCell) {
      event.preventDefault();
      var table = document.activeElement.attachedTableCell.parentElement.parentElement;
      var tableNodes = getTableNodes(table);
      var newNode = createNode();
      tableNodes.splice(tableNodes.indexOf(document.activeElement) + 1, 0, newNode);
      rebuildTable(table, tableNodes);
      document.activeElement.classList.remove('selected');
      newNode.focus();
      newNode.classList.add('selected');
      return false;
    }
  } else if (event.ctrlKey && event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    if (document.activeElement && document.activeElement.classList.contains('node') && isTableElementNode(document.activeElement)) {
      var table = document.activeElement.attachedTableCell.parentElement.parentElement;
      var tableNodes = getTableNodes(table);
      var index = tableNodes.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' && index < tableNodes.length) {
        tableNodes.splice(index, 1);
        tableNodes.splice(index + 1, 0, document.activeElement);
      } else if (event.key === 'ArrowUp' && index > 0) {
        tableNodes.splice(index, 1);
        tableNodes.splice(index - 1, 0, document.activeElement);
      }
      rebuildTable(table, tableNodes);
    }
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    if (document.activeElement && document.activeElement.classList.contains('node')) {
      if (isTableElementNode(document.activeElement)) {
        event.preventDefault();
        if (event.key === 'ArrowDown') {
          focusNextTableElementNode(document.activeElement);
        } else {
          focusPreviousTableElementNode(document.activeElement);
        }
        return false;
      }
    }
  }
}

function handleKeypressForTable(event) {
  if (event.key === 't') {
    var selectedNodes = Array.from(document.querySelectorAll('.node.selected'));
    if (document.activeElement && selectedNodes.length === 2) {
      event.preventDefault();
      var baseNode = document.activeElement;
      var forwardNode = selectedNodes[0] === document.activeElement ? selectedNodes[1] : selectedNodes[0];
      if (Array.from(baseNode.links).find(link => link.from === baseNode && link.via === forwardNode)) {
        createTable(baseNode, forwardNode);
      }
      return false;
    }
  } else if (event.key === 'Delete' && event.ctrlKey) {
    if (document.activeElement && document.activeElement.classList.contains('node') && document.activeElement.attachedTableCell) {
      event.preventDefault();
      var table = document.activeElement.attachedTableCell.parentElement.parentElement;
      var tableNodes = getTableNodes(table);
      var index = tableNodes.indexOf(document.activeElement);
      tableNodes.splice(index, 1);
      rebuildTable(table, tableNodes);
      document.activeElement.attachedTableCell = null;
      deleteElements([document.activeElement]);
      if (tableNodes.length) {
        var nextNode = null;
        if (index === tableNodes.length) {
          nextNode = tableNodes[tableNodes.length-1];
        } else {
          nextNode = tableNodes[index];
        }
        nextNode.focus();
        nextNode.classList.add('selected');
      }
      return false;
    }
  }
}
