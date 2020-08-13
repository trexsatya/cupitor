

function showTree(_data, id, opts) {
  var options = opts || {}

  // ### DATA MODEL START

  var data = _data || {
    type: 'action',
    name: '1',
    attributes: [],
    innerText: '0',
    children: [{
      type: 'children',
      name: 'satya',
      innerText: '1',
      // attributes: [{
      //     'source-type-property-value': 'streetlight'
      // }],
      children: []
    }]
  };

  // ### DATA MODEL END

  // Set the dimensions and margins of the diagram
  var margin = { top: 40, right: 0, bottom: 0, left: 0 };
    var width = 1200 - margin.right - margin.left;
    var height = 1000 - margin.top - margin.bottom;

  var treeContainer = $("<div></div>").attr({id: id})

  $("#textillateContainer").append(treeContainer)

  treeContainer.draggable();

  // append the svg object to the body of the page
  // appends a 'group' element to 'svg'
  // moves the 'group' element to the top left margin
  var svg = d3.select("#"+id).
      append("svg").
    attr("width", width).
    attr("height", height).
    append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var i = 0, duration = 750, root;

  // declares a tree layout and assigns the size
  var treemap = d3.tree().size([height, width]);

  // Assigns parent, children, height, depth
  root = d3.hierarchy(data, function(d) {
      return d.children;
  });
  root.x0 = width / 2;
  root.y0 = 0;

  update(root);

  var selected = null;

  var addBtn = $("<button>Add</button>").css({ position: 'absolute', left: 69 })
  var removeBtn = $("<button>Remove</button>").css({ position: 'absolute', left: 0 })

  addBtn[0].disabled = true;
  removeBtn[0].disabled = true;

  $("#"+id).prepend(addBtn);
  $("#"+id).prepend(removeBtn);

  var onAdd= function() {
    console.log(selected);
    //creates New OBJECT
    var newNodeObj = {
      type: 'resource-delete',
      name: new Date().getTime(),
      attributes: [],
      children: []
    };
    //Creates new Node 
    var newNode = d3.hierarchy(newNodeObj);
    newNode.depth = selected.depth + 1; 
    newNode.height = selected.height - 1;
    newNode.parent = selected; 
    newNode.id = Date.now();
    
    if(!selected.children){
      selected.children = [];
      selected.data.children = [];
    }
    selected.children.push(newNode);
    selected.data.children.push(newNode.data);
    
    update(selected);
  };

  var onRemove = function() {
      console.log(selected);
  };

  addBtn.click(onAdd)
  removeBtn.click(onRemove)

  function update(source) {

    // Assigns the x and y position for the nodes
    var treeData = treemap(root);

    // Compute the new tree layout.
    var nodes = treeData.descendants(),
      links = treeData.descendants().slice(1);

    // Normalize for fixed-depth.
    nodes.forEach(function(d){
      d.y = d.depth * 100
    });

    // ### LINKS

    // Update the links...
    var link = svg.selectAll('line.link').
      data(links, function(d) {
          return d.id;
      });

    // Enter any new links at the parent's previous position.
    var linkEnter = link.enter().
      append('line').
      attr("class", "link").
      attr("stroke-width", 2).
      attr("stroke", 'black').
      attr('x1', function(d) {
          return source.x0;
      }).
      attr('y1', function(d) {
          return source.y0;
      }).
      attr('x2', function(d) {
          return source.x0;
      }).
      attr('y2', function(d) {
          return source.y0;
      });
      
    var linkUpdate = linkEnter.merge(link);
    
    linkUpdate.transition().
      duration(duration).
      attr('x1', function(d) {
          return d.parent.x;
      }).
      attr('y1', function(d) {
          return d.parent.y;
      }).
      attr('x2', function(d) {
          return d.x;
      }).
      attr('y2', function(d) {
          return d.y;
      });

    // Transition back to the parent element position
    linkUpdate.transition().
      duration(duration).
      attr('x1', function(d) {
          return d.parent.x;
      }).
      attr('y1', function(d) {
          return d.parent.y;
      }).
      attr('x2', function(d) {
          return d.x;
      }).
      attr('y2', function(d) {
          return d.y;
      });

    // Remove any exiting links
    var linkExit = link.exit().
      transition().
      duration(duration).
      attr('x1', function(d) {
          return source.x;
      }).
      attr('y1', function(d) {
          return source.y;
      }).
      attr('x2', function(d) {
          return source.x;
      }).
      attr('y2', function(d) {
          return source.y;
      }).
      remove();

      // ### CIRCLES

    // Update the nodes...
    var node = svg.selectAll('g.node')
      .data(nodes, function(d) {
          return d.id || (d.id = ++i);
      });

    // Enter any new modes at the parent's previous position.
    var nodeEnter = node.enter().
      append('g').
      attr('class', 'node').
      attr("transform", function(d) {
        return "translate(" + source.x0 + "," + source.y0 + ")";
      }).
      on('click', options.dynamic ? enableModification : toggleChildren);



    // Add Circle for the nodes
    nodeEnter.append('circle').
      attr('class', 'node').
      attr('r', 25).
      style("fill", function(d) {
          return "#0e4677";
      });

     nodeEnter.append("text")
      // .attr("y", function (d) {
      //     return d.children || d._children ? -18 : 18;
      // })
      .attr("stroke", "white")
      // .attr("y", "50%")
      .attr("stroke-width", "1px")
      .attr("alignment-baseline", "central")
      // .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .text(function (d) { 
        return d.data.innerText || '' 
      })
      .style("fill-opacity", 1e-6);
   

    // Update
    var nodeUpdate = nodeEnter.merge(node);

    // Transition to the proper position for the node
    nodeUpdate.transition().
      duration(duration).
      attr("transform", function(d) {
          return "translate(" + d.x + "," + d.y + ")";
      });

    // Update the node attributes and style
    nodeUpdate.select('circle.node').
      attr('r', 25).
      style("fill", function(d) {
          return "#0e4677";
      }).
      attr('cursor', 'pointer');

    nodeUpdate.select("text")
            .style("fill-opacity", 1);

    // Remove any exiting nodes
    var nodeExit = node.exit().
      transition().
      duration(duration).
      attr("transform", function(d) {
          return "translate(" + source.x + "," + source.y + ")";
      }).
      remove();

    // On exit reduce the node circles size to 0
    nodeExit.select('circle').attr('r', 0);
    nodeExit.select("text")
            .style("fill-opacity", 1e-6);

    // Store the old positions for transition.
    nodes.forEach(function(d){
      d.x0 = d.x;
      d.y0 = d.y;
    });

    
  }

  // Toggle children on click.
    function enableModification(d) {
      selected = d;
      addBtn[0].disabled = false;
      removeBtn[0].disabled = false;
      update(d);
    }

    function toggleChildren(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        update(d);
    }


  return {
    rootData: root,
    treeNodes: () => { return treemap(root).descendants() },
    clickNode: (d) => { toggleChildren(d) }
  }

}


function addLabelToTreeNode(label, node, treeContainerSel, opts) {
  let treeContainer = $(treeContainerSel || "").position() || {top: 0, left: 0};
  node.data.labels = node.data.labels || []

  let lab = createTextBox(label, { top: treeContainer.top + node.y0, left: treeContainer.left + node.x0})
  node.data.labels.push(lab)
}

