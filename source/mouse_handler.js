'use strict';

var cursorPositionOnMouseDragStart          = null;
var cursorPositionOffsetOnMouseDragStart    = null;
var cursorOnTargetPositionStart             = null;
var cursorPositionOnLastDragMousemove       = null;
var cursorScreenPositionOnLastDragMousemove = null;

function handlePointerDrag(event, options) {
  const target = options.target || event.target;
  cursorPositionOnMouseDragStart          = { x: event.pageX,   y: event.pageY   };
  cursorPositionOffsetOnMouseDragStart    = { x: event.offsetX, y: event.offsetY };
  cursorOnTargetPositionStart             = { x: target.scrollLeft + event.offsetX, y: target.scrollTop + event.offsetY };
  cursorScreenPositionOnLastDragMousemove = { x: event.screenX, y: event.screenY };
  cursorPositionOnLastDragMousemove = cursorPositionOnMouseDragStart;
  let lastCursorClientPosition = {x: event.clientX, y: event.clientY};
  function distance(pointA, pointB) {
    const deltaX = Math.abs(pointA.x - pointB.x);
    const deltaY = Math.abs(pointA.y - pointB.y);
    return Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
  }
  function handlePointermove(event) {
    const cursorClientPosition = {x: event.clientX, y: event.clientY};
    const wasOutsideWindow = lastCursorClientPosition.x < 0 ||
                             lastCursorClientPosition.y < 0 ||
                             lastCursorClientPosition.x > window.innerWidth ||
                             lastCursorClientPosition.y > window.innerHeight;
    const isInsideWindow = cursorClientPosition.x >= 0 && cursorClientPosition.x < window.innerWidth &&
                           cursorClientPosition.y >= 0 && cursorClientPosition.y < window.innerHeight;
    // If the cursor appears to teleport from somewhere outside the window to inside, then ignore the event as it seems to be a bug with chrome or my window manager
    const badPointerEvent = wasOutsideWindow && isInsideWindow && distance(cursorClientPosition, lastCursorClientPosition) > 20;
    if (options.onmove && !badPointerEvent) {
      const position       = { x: event.pageX,   y: event.pageY   };
      const positionScreen = { x: event.screenX, y: event.screenY };
      const delta = {x: position.x - cursorPositionOnLastDragMousemove.x, y: position.y - cursorPositionOnLastDragMousemove.y};
      const deltaTotal = {x: position.x - cursorPositionOnMouseDragStart.x, y: position.y - cursorPositionOnMouseDragStart.y};
      const deltaScreen = {x: positionScreen.x - cursorScreenPositionOnLastDragMousemove.x, y: positionScreen.y - cursorScreenPositionOnLastDragMousemove.y};
      const positionOffset = { x: cursorPositionOffsetOnMouseDragStart.x + deltaTotal.x, y: cursorPositionOffsetOnMouseDragStart.y + deltaTotal.y };
      const positionOnTarget = { x: target.scrollLeft + cursorPositionOffsetOnMouseDragStart.x + deltaTotal.x, y: target.scrollTop + cursorPositionOffsetOnMouseDragStart.y + deltaTotal.y };
      cursorPositionOnLastDragMousemove = position;
      cursorScreenPositionOnLastDragMousemove = positionScreen;
      options.onmove({position, positionOffset, positionOnTarget, delta, deltaTotal, deltaScreen});
    }
    lastCursorClientPosition = cursorClientPosition;
  }
  const pointerId = event.pointerId;
  if (options.capturePointer !== false) {
    target.setPointerCapture(pointerId);
  }
  window.addEventListener('pointermove', handlePointermove);
  window.addEventListener(
    'pointerup',
    event => {
      window.removeEventListener('pointermove', handlePointermove);
      if (options.capturePointer !== false) {
        target.releasePointerCapture(pointerId);
      }
      if (options.onup) {
        const position   = {x: event.pageX, y: event.pageY};
        const deltaTotal = {x: position.x - cursorPositionOnMouseDragStart.x, y: position.y - cursorPositionOnMouseDragStart.y};
        options.onup(event, {position, deltaTotal});
      }
    },
    {once: true}
  );
}

function handleNodeMousedown(event) {
  event.preventDefault();
  const node = event.target;
  if (event.ctrlKey) {
    if (!event.shiftKey) {
      deselectAll();
    }
    const connectedNodes = getConnectedNodes(node).filter(connectedNode => connectedNode.dataset.id === node.dataset.id);
    for (const connectedNode of connectedNodes) {
      connectedNode.classList.add('selected');
      if (connectedNode.overflowMap) {
        for (const nodeShadow of Object.values(connectedNode.overflowMap)) {
          nodeShadow.classList.add('selected');
        }
      }
    }
    return;
  }
  setCursorPosition({
    x: pxToGridX(parseInt(node.style.left)),
    y: pxToGridY(parseInt(node.style.top)),
  });
  if (event.shiftKey) {
    node.classList.toggle('selected');
  } else {
    if (!node.classList.contains('selected')) {
      deselectAll();
    }
  }
  if (linkBeingCreated) {
    useNodeForLinkCreationMode(node);
    return false;
  }
  // Node dragging
  const nodesToDrag = [...currentSurface.getElementsByClassName('node')].filter(node_ => node_.classList.contains('selected') || node_ === node);
  for (let node of nodesToDrag) {
    node.dragStartPosition = {x: parseInt(node.style.left), y: parseInt(node.style.top)};
  }
  const nodesNotBeingDragged = [...currentSurface.getElementsByClassName('node')].filter(node_ => !node_.classList.contains('selected') && node_ !== node);
  const cursorStartPosition = {x: parseInt(cursor.style.left), y: parseInt(cursor.style.top)};
  const selectionBoxStartPosition = getSelectionBox();
  isActionInProgress = true;
  handlePointerDrag(event, {
    onmove: function(mouse) {
      document.body.classList.add('dragging');
      const cursorPosition = {
        x: cursorStartPosition.x + pxToGridX(mouse.deltaTotal.x),
        y: cursorStartPosition.y + pxToGridY(mouse.deltaTotal.y),
      }
      const cursorDelta = {
        x: cursorPosition.x - cursorStartPosition.x,
        y: cursorPosition.y - cursorStartPosition.y,
      }
      // Don't allow dragging off the edge of the document
      const leftmost = Math.min(...nodesToDrag.map(node => node.dragStartPosition.x + cursorDelta.x));
      const topmost  = Math.min(...nodesToDrag.map(node => node.dragStartPosition.y + cursorDelta.y));
      if (leftmost < 0) {
        cursorPosition.x += -leftmost;
        cursorDelta.x    += -leftmost;
      }
      if (topmost < 0) {
        cursorPosition.y += -topmost;
        cursorDelta.y    += -topmost;
      }
      // Don't allow dragging to where nodes would overlap with other nodes
      for (const node of nodesToDrag) {
        const newNodeBoundingBox = {
          left:   node.dragStartPosition.x + cursorDelta.x,
          top:    node.dragStartPosition.y + cursorDelta.y,
          right:  node.dragStartPosition.x + cursorDelta.x + getNodeWidthForName(node.value),
          bottom: node.dragStartPosition.y + cursorDelta.y + 20,
        };
        if (getNodesIntersectingBox(newNodeBoundingBox, nodesNotBeingDragged).length !== 0) {
          return;
        }
      }
      // Move nodes
      const affectedLinks = new Set();
      for (const node of nodesToDrag) {
        node.style.left = (node.dragStartPosition.x + cursorDelta.x) + 'px';
        node.style.top  = (node.dragStartPosition.y + cursorDelta.y) + 'px';
        for (const link of node.links) affectedLinks.add(link);
      }
      for (const link of affectedLinks) layoutLink(link);
      // Move cursor
      setCursorPosition(cursorPosition);
      // Move selection box
      if (selectionBoxStartPosition) {
        selectionBox.style.left = (selectionBoxStartPosition.left + pxToGridX(cursorPosition.x - cursorStartPosition.x)) + 'px';
        selectionBox.style.top  = (selectionBoxStartPosition.top  + pxToGridY(cursorPosition.y - cursorStartPosition.y)) + 'px';
      }
    },
    onup: function(event, mouse) {
      for (const node of nodesToDrag) node.classList.remove('dragging');
      if (Math.abs(mouse.deltaTotal.x) > 32 || Math.abs(mouse.deltaTotal.y) > 16) {
        const oldPositions = nodesToDrag.map(node => {return {node: node, left: node.dragStartPosition.x+'px', top: node.dragStartPosition.y+'px'}});
        const newPositions = nodesToDrag.map(node => {return {node: node, left: node.style.left, top: node.style.top}});
        recordAction(
          moveNodesAction({oldPositions, newPositions}),
          {
            cursor: {before: cursorStartPosition, after: {x: parseInt(cursor.style.left), y: parseInt(cursor.style.top)}},
            selectionBox: {before: selectionBoxStartPosition, after: getSelectionBox()}
          }
        );
      }
      isActionInProgress = false;
      document.body.classList.remove('dragging');
    }
  });
}


for (const surface of document.getElementsByClassName('surface')) {
  surface.addEventListener('pointerdown', handlePointerDownForSurface);
  surface.addEventListener('contextmenu', handleContextMenuForSurface);
  surface.addEventListener('dblclick',    handleDblClickForSurface);
}

function handleContextMenuForSurface(event) {
  event.preventDefault();
  return false;
}

function handlePointerDownForSurface(event) {
  const surface = event.target.closest('.surface');
  if (surface) {
    setCurrentSurface(surface);
  }

  // Middle mouse button drag
  if (event.button === 1) {
    event.preventDefault();
    document.body.classList.add('dragging');
    handlePointerDrag(event, {
      onmove: cursor => surface.scrollBy(-cursor.deltaScreen.x, -cursor.deltaScreen.y),
      onup: event => {
        event.preventDefault();
        document.body.classList.remove('dragging');
        return false;
      }
    });
    return false;
  }

  // Left button down on surface
  if (event.button === 0 && event.target.classList.contains('surface')) {
    event.preventDefault();
    setCurrentSurface(event.target);
    setCursorPosition({
      x: pxToGridX(surface.scrollLeft + event.offsetX),
      y: pxToGridY(surface.scrollTop  + event.offsetY),
    });
    selectionBox.classList.add('hidden');

    let selectedNodesToPreserve = null;
    if (!event.shiftKey) {
      deselectAll();
      if (document.activeElement) document.activeElement.blur();
    } else {
      selectedNodesToPreserve = new Set(currentSurface.getElementsByClassName('selected'));
    }
    selectionBox.anchorPosition = undefined;
    handlePointerDrag(event, {
      onmove: function(cursor) {
        document.body.classList.add('dragging-selection-box');
        const cursorPosition = {x: pxToGridX(cursor.positionOnTarget.x), y: pxToGridY(cursor.positionOnTarget.y)};
        if (cursorPosition.x < 0) cursorPosition.x = 0;
        if (cursorPosition.y < 0) cursorPosition.y = 0;
        if (!selectionBox.anchorPosition) {
          selectionBox.anchorPosition = {x: pxToGridX(cursorOnTargetPositionStart.x), y: pxToGridY(cursorOnTargetPositionStart.y)};
        }
        setSelectionBox(getBoundingBoxForPoints(selectionBox.anchorPosition, cursorPosition), selectedNodesToPreserve);
        selectionBox.classList.remove('hidden');
        setCursorPosition(cursorPosition);
      },
      onup: function() {
        document.body.classList.remove('dragging-selection-box');
      }
    });

    return false;
  }

  // Right mouse button down on node
  if (event.button === 2 && event.target.classList.contains('node')) {
    event.preventDefault();
    const link = createLink();
    link.from = event.target;
    const fromPosition = {x: parseInt(link.from.style.left), y: parseInt(link.from.style.top)};
    handlePointerDrag(event, {
      onmove: cursor => layoutLink(link, {x: fromPosition.x + cursor.deltaTotal.x + 32, y: fromPosition.y + cursor.deltaTotal.y + 16}),
      onup: function(event) {
        if (link.from && link.via && link.to) {
          recordAction(createElementsAction([link]));
        } else {
          link.remove();
        }
        surface.removeEventListener('mouseover', handleMouseover);
      },
      target: surface,
      capturePointer: false,
    });
    function handleMouseover(event) {
      if (event.target.classList.contains('node') && ![link.from, link.via, link.to].includes(event.target)) {
        if (!link.via) {
          link.via = event.target;
          layoutLink(link);
        } else if (!link.to) {
          link.to = event.target;
          surface.removeEventListener('mouseover', handleMouseover);
          layoutLink(link);
          link.from.links.add(link);
          link.via.links.add(link);
          link.to.links.add(link);
          link.classList.add('link');
          link.classList.remove('unfinished-link');
        }
      }
    }
    surface.addEventListener('mouseover', handleMouseover);
    return false;
  }

  // Left mouse button down on node
  if (event.button === 0 && event.target.classList.contains('node')) {
    handleNodeMousedown(event);
  }

  // Left mouse button down on link
  if (event.button === 0 && event.target.classList.contains('link')) {
    event.preventDefault();
    if (event.shiftKey) {
      event.target.classList.toggle('selected');
    } else {
      deselectAll();
      event.target.classList.add('selected');
    }
    return false;
  }
};

function handleDblClickForSurface(event) {
  const surface = event.target.closest('.surface');
  if (event.target.classList.contains('surface')) {
    const closestNode = getNodeClosestToPosition({
      x: pxToGridX(surface.scrollLeft + event.offsetX),
      y: pxToGridY(surface.scrollTop  + event.offsetY),
    }, surface);
    if (closestNode) {
      if (!event.shiftKey) {
        deselectAll();
      }
      const connectedNodes = getConnectedNodes(closestNode);
      for (const node of connectedNodes) {
        node.classList.add('selected');
        if (node.overflowMap) {
          for (const nodeShadow of Object.values(node.overflowMap)) {
            nodeShadow.classList.add('selected');
          }
        }
      }
    }
  } else if (event.target.classList.contains('node')) {
    if (!event.shiftKey) {
      deselectAll();
    }
    if (event.ctrlKey) {
      for (const node of surface.querySelectorAll(`.node[data-id='${event.target.dataset.id}']`)) {
        node.classList.add('selected');
        if (node.overflowMap) {
          for (const nodeShadow of Object.values(node.overflowMap)) {
            nodeShadow.classList.add('selected');
          }
        }
      }
    } else {
      const connectedNodes = getConnectedNodes(event.target);
      for (const node of connectedNodes) {
        node.classList.add('selected');
        if (node.overflowMap) {
          for (const nodeShadow of Object.values(node.overflowMap)) {
            nodeShadow.classList.add('selected');
          }
        }
      }
    }
  } else if (event.target.classList.contains('link')) {
    const connectedLinks = new Set([event.target]);
    const connectedNodes = new Set([event.target.from, event.target.via, event.target.to]);
    getAllConnectedNodesAndLinks(event.target.to, connectedNodes, connectedLinks);
    connectedNodes.delete(event.target.from);
    for (const node of connectedNodes) {
      node.classList.add('selected');
      if (node.overflowMap) {
        for (const nodeShadow of Object.values(node.overflowMap)) {
          nodeShadow.classList.add('selected');
        }
      }
    }
  }
};

// Node/link instance highlighting
document.addEventListener('mouseover', event => {
  if (event.target.classList.contains('node')) {
    const instances = [...document.querySelectorAll(`[data-id="${event.target.dataset.id}"]`)];
    for (const instance of instances) {
      instance.classList.add('mouse-over-instance');
      if (instance.overflowMap) {
        for (const nodeShadow of Object.values(instance.overflowMap)) {
          nodeShadow.classList.add('mouse-over-instance');
        }
      }
    }
    event.target.addEventListener(
      'mouseleave',
      event => {
        for (const instance of instances) {
          instance.classList.remove('mouse-over-instance');
          if (instance.overflowMap) {
            for (const nodeShadow of Object.values(instance.overflowMap)) {
              nodeShadow.classList.remove('mouse-over-instance');
            }
          }
        }
      },
      {once: true}
    );
  } else if (event.target.classList.contains('link')) {
    if (!(event.target.from && event.target.via && event.target.to)) {
      return;
    }
    event.target.parentElement.appendChild(event.target);
    const instances = [...document.getElementsByClassName('link')].filter(link => {
      return (link.from && link.via && link.to) &&
             link.from.dataset.id === event.target.from.dataset.id &&
             link.via.dataset.id  === event.target.via.dataset.id  &&
             link.to.dataset.id   === event.target.to.dataset.id;
    });
    for (const instance of instances) {
      instance.classList.add('mouse-over-instance');
    }
    event.target.addEventListener(
      'mouseleave',
      event => {
        for (const instance of instances) instance.classList.remove('mouse-over-instance');
      },
      {once: true}
    );
  }
});