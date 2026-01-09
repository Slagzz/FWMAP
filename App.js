import React, { useState, useCallback, useRef, useEffect } from 'react';

const FirmwareMapper = () => {
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [connections, setConnections] = useState([]);
  const [viewMode, setViewMode] = useState('tree');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const fileInputRef = useRef(null);
  const fmapInputRef = useRef(null);
  const [nodePositions, setNodePositions] = useState({});
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const mindmapContainerRef = useRef(null);

  const nodeTypes = {
    readonly: { color: '#3b82f6', label: 'Read-Only', icon: '🔒' },
    writable: { color: '#22c55e', label: 'Writable', icon: '✏️' },
    executable: { color: '#f59e0b', label: 'Executable', icon: '⚡' },
    bootrun: { color: '#ef4444', label: 'Runs on Boot', icon: '🚀' },
    config: { color: '#8b5cf6', label: 'Config', icon: '⚙️' },
    library: { color: '#06b6d4', label: 'Library', icon: '📚' },
    kernel: { color: '#ec4899', label: 'Kernel', icon: '🧠' },
    vulnerable: { color: '#dc2626', label: 'Potential Vuln', icon: '⚠️' },
    unknown: { color: '#6b7280', label: 'Unknown', icon: '❓' },
  };

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const processFileSystem = async (files) => {
    const fileTree = {};
    
    for (const file of files) {
      const pathParts = file.webkitRelativePath.split('/');
      let current = fileTree;
      
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (i === pathParts.length - 1) {
          current[part] = { type: 'file', size: file.size, name: part };
        } else {
          if (!current[part]) {
            current[part] = { type: 'folder', children: {}, name: part };
          }
          current = current[part].children;
        }
      }
    }

    const newPositions = {};
    
    const convertToNodes = (tree, parentId = null, depth = 0, startX = 600, startY = 80) => {
      const result = [];
      const entries = Object.entries(tree);
      const totalWidth = Math.max(entries.length * 180, 200);
      
      entries.forEach(([key, value], idx) => {
        const id = generateId();
        const nodeX = startX - totalWidth/2 + idx * 180 + 90;
        const nodeY = startY + depth * 140;
        
        newPositions[id] = { x: nodeX, y: nodeY };
        
        const node = {
          id,
          name: key,
          type: value.type,
          nodeType: 'unknown',
          parentId,
          size: value.size || 0,
          notes: '',
          depth,
        };
        
        result.push(node);
        
        if (value.type === 'folder' && value.children) {
          const childNodes = convertToNodes(value.children, id, depth + 1, nodeX, nodeY);
          result.push(...childNodes);
        }
      });
      
      return result;
    };

    const newNodes = convertToNodes(fileTree);
    setNodes(newNodes);
    setNodePositions(newPositions);
    
    const newConnections = newNodes
      .filter(n => n.parentId)
      .map(n => ({ from: n.parentId, to: n.id }));
    setConnections(newConnections);
    
    // Expand root and first level
    const rootIds = newNodes.filter(n => !n.parentId).map(n => n.id);
    const firstLevelIds = newNodes.filter(n => rootIds.includes(n.parentId)).map(n => n.id);
    setExpandedNodes(new Set([...rootIds, ...firstLevelIds]));
  };

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      processFileSystem(files);
    }
  };

  const toggleNodeExpand = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const updateNodeType = (nodeId, newType) => {
    setNodes(prev => prev.map(n => 
      n.id === nodeId ? { ...n, nodeType: newType } : n
    ));
    setSelectedNode(prev => prev && prev.id === nodeId ? { ...prev, nodeType: newType } : prev);
  };

  const updateNodeNotes = (nodeId, notes) => {
    setNodes(prev => prev.map(n => 
      n.id === nodeId ? { ...n, notes } : n
    ));
    setSelectedNode(prev => prev && prev.id === nodeId ? { ...prev, notes } : prev);
  };

  const exportFMAP = () => {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      nodes,
      connections,
      nodePositions,
      expandedNodes: Array.from(expandedNodes),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firmware-map.fmap';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFMAP = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          setNodes(data.nodes || []);
          setConnections(data.connections || []);
          setNodePositions(data.nodePositions || {});
          setExpandedNodes(new Set(data.expandedNodes || []));
        } catch (err) {
          alert('Invalid FMAP file');
        }
      };
      reader.readAsText(file);
    }
  };

  // Get all ancestor IDs for a node
  const getAncestorIds = (nodeId) => {
    const ancestors = [];
    let current = nodes.find(n => n.id === nodeId);
    while (current && current.parentId) {
      ancestors.push(current.parentId);
      current = nodes.find(n => n.id === current.parentId);
    }
    return ancestors;
  };

  // Check if a node matches the current filters
  const nodeMatchesFilter = (node) => {
    const matchesSearch = !searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || node.nodeType === filterType;
    return matchesSearch && matchesType;
  };

  // Get nodes that should be visible in tree view
  const getVisibleTreeNodes = () => {
    // If there's a search or filter, show matching nodes and their ancestors
    if (searchTerm || filterType !== 'all') {
      const matchingNodes = nodes.filter(nodeMatchesFilter);
      const visibleIds = new Set();
      
      matchingNodes.forEach(node => {
        visibleIds.add(node.id);
        getAncestorIds(node.id).forEach(id => visibleIds.add(id));
      });
      
      return nodes.filter(n => visibleIds.has(n.id));
    }
    
    // Otherwise, use expand/collapse logic
    const visible = new Set();
    
    const addVisibleChildren = (parentId) => {
      if (!expandedNodes.has(parentId)) return;
      nodes.forEach(n => {
        if (n.parentId === parentId) {
          visible.add(n.id);
          if (n.type === 'folder') {
            addVisibleChildren(n.id);
          }
        }
      });
    };
    
    nodes.filter(n => !n.parentId).forEach(n => {
      visible.add(n.id);
      if (n.type === 'folder') {
        addVisibleChildren(n.id);
      }
    });
    
    return nodes.filter(n => visible.has(n.id));
  };

  // Get nodes visible in mind map view
  const getVisibleMindmapNodes = () => {
    // Apply search/filter first
    let filtered = nodes;
    if (searchTerm || filterType !== 'all') {
      const matchingNodes = nodes.filter(nodeMatchesFilter);
      const visibleIds = new Set();
      
      matchingNodes.forEach(node => {
        visibleIds.add(node.id);
        getAncestorIds(node.id).forEach(id => visibleIds.add(id));
      });
      
      filtered = nodes.filter(n => visibleIds.has(n.id));
    }
    
    // Then apply expand/collapse
    const visible = new Set();
    
    const addVisibleChildren = (parentId) => {
      if (!expandedNodes.has(parentId)) return;
      filtered.forEach(n => {
        if (n.parentId === parentId) {
          visible.add(n.id);
          if (n.type === 'folder') {
            addVisibleChildren(n.id);
          }
        }
      });
    };
    
    filtered.filter(n => !n.parentId).forEach(n => {
      visible.add(n.id);
      if (n.type === 'folder') {
        addVisibleChildren(n.id);
      }
    });
    
    return filtered.filter(n => visible.has(n.id));
  };

  const getChildCount = (nodeId) => {
    return nodes.filter(n => n.parentId === nodeId).length;
  };

  const handleNodeDrag = (nodeId, e) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = nodePositions[nodeId] || { x: 0, y: 0 };
    
    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setNodePositions(prev => ({
        ...prev,
        [nodeId]: { x: startPos.x + dx, y: startPos.y + dy }
      }));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Pan handlers for mindmap
  const handlePanStart = (e) => {
    if (e.target.closest('.mindmap-node')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePanMove = (e) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  // Zoom handler
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * delta, 0.1), 3);
    
    // Get mouse position relative to container
    const rect = mindmapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Adjust pan to zoom toward mouse position
    const newPan = {
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom)
    };
    
    setZoom(newZoom);
    setPan(newPan);
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const renderTreeNode = (node, visibleNodes, depth = 0) => {
    const hasChildren = nodes.some(n => n.parentId === node.id);
    const isExpanded = expandedNodes.has(node.id);
    const childCount = getChildCount(node.id);
    const typeInfo = nodeTypes[node.nodeType];
    const isFiltering = searchTerm || filterType !== 'all';
    const matchesFilter = nodeMatchesFilter(node);
    
    // Get visible children
    const visibleChildren = visibleNodes.filter(n => n.parentId === node.id);
    
    return (
      <div key={node.id} className="tree-node" style={{ marginLeft: depth * 20 }}>
        <div 
          className={`node-row ${selectedNode?.id === node.id ? 'selected' : ''} ${isFiltering && !matchesFilter ? 'dimmed' : ''}`}
          onClick={() => setSelectedNode(node)}
          style={{ borderLeftColor: typeInfo.color }}
        >
          {hasChildren && (
            <button 
              className="expand-btn"
              onClick={(e) => { e.stopPropagation(); toggleNodeExpand(node.id); }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span className="expand-placeholder" />}
          
          <span className="node-icon">{node.type === 'folder' ? '📁' : '📄'}</span>
          <span className="node-name">{node.name}</span>
          <span className="type-badge" style={{ backgroundColor: typeInfo.color }}>
            {typeInfo.icon} {typeInfo.label}
          </span>
          {childCount > 0 && !isExpanded && (
            <span className="child-count">{childCount} items</span>
          )}
        </div>
        
        {(isExpanded || isFiltering) && visibleChildren.length > 0 && (
          <div className="children">
            {visibleChildren.map(child => 
              renderTreeNode(child, visibleNodes, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMindmapNode = (node) => {
    const pos = nodePositions[node.id] || { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 };
    const typeInfo = nodeTypes[node.nodeType];
    const hasChildren = nodes.some(n => n.parentId === node.id);
    const isExpanded = expandedNodes.has(node.id);
    const childCount = getChildCount(node.id);
    
    return (
      <div
        key={node.id}
        className={`mindmap-node ${selectedNode?.id === node.id ? 'selected' : ''}`}
        style={{
          left: pos.x,
          top: pos.y,
          borderColor: typeInfo.color,
          boxShadow: `0 0 20px ${typeInfo.color}40`,
        }}
        onClick={(e) => { e.stopPropagation(); setSelectedNode(node); }}
        onMouseDown={(e) => handleNodeDrag(node.id, e)}
      >
        <div className="mindmap-node-header" style={{ backgroundColor: typeInfo.color }}>
          {typeInfo.icon}
        </div>
        <div className="mindmap-node-body">
          <span className="node-type-icon">{node.type === 'folder' ? '📁' : '📄'}</span>
          <span className="mindmap-node-name" title={node.name}>{node.name}</span>
          {hasChildren && (
            <button 
              className="mindmap-expand-btn"
              onClick={(e) => { e.stopPropagation(); toggleNodeExpand(node.id); }}
            >
              {isExpanded ? '−' : `+${childCount}`}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderConnections = (visibleNodes) => {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    
    return (
      <svg className="connection-svg">
        {connections
          .filter(c => visibleNodeIds.has(c.from) && visibleNodeIds.has(c.to))
          .map((conn, idx) => {
            const fromPos = nodePositions[conn.from];
            const toPos = nodePositions[conn.to];
            if (!fromPos || !toPos) return null;
            
            const fromNode = nodes.find(n => n.id === conn.from);
            const typeInfo = nodeTypes[fromNode?.nodeType || 'unknown'];
            
            // Calculate connection points (center bottom of parent, center top of child)
            const x1 = fromPos.x + 80;
            const y1 = fromPos.y + 70;
            const x2 = toPos.x + 80;
            const y2 = toPos.y;
            
            // Create a curved path
            const midY = (y1 + y2) / 2;
            const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
            
            return (
              <path
                key={idx}
                d={path}
                stroke={typeInfo.color}
                strokeWidth="2"
                strokeOpacity="0.6"
                fill="none"
              />
            );
          })}
      </svg>
    );
  };

  const visibleTreeNodes = getVisibleTreeNodes();
  const visibleMindmapNodes = getVisibleMindmapNodes();
  const rootNodes = visibleTreeNodes.filter(n => !n.parentId);

  return (
    <div className="firmware-mapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Orbitron:wght@400;700;900&display=swap');
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        .firmware-mapper {
          min-height: 100vh;
          background: #0a0a0f;
          background-image: 
            radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, rgba(239, 68, 68, 0.08) 0%, transparent 50%),
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 100% 100%, 100% 100%, 40px 40px, 40px 40px;
          color: #e5e7eb;
          font-family: 'JetBrains Mono', monospace;
          display: flex;
          flex-direction: column;
        }
        
        .header {
          padding: 20px 30px;
          background: linear-gradient(180deg, rgba(15, 15, 25, 0.98) 0%, rgba(10, 10, 15, 0.95) 100%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          backdrop-filter: blur(10px);
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .logo-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #3b82f6 0%, #ef4444 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 0 30px rgba(59, 130, 246, 0.4);
        }
        
        .logo-text {
          font-family: 'Orbitron', sans-serif;
          font-size: 1.5rem;
          font-weight: 900;
          background: linear-gradient(135deg, #3b82f6, #ef4444);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: 2px;
        }
        
        .logo-subtitle {
          font-size: 0.7rem;
          color: #6b7280;
          letter-spacing: 3px;
          text-transform: uppercase;
        }
        
        .toolbar {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        
        .btn {
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          color: #e5e7eb;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border-color: #3b82f6;
        }
        
        .btn-primary:hover {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
        }
        
        .btn-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border-color: #ef4444;
        }
        
        .main-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        
        .sidebar {
          width: 280px;
          background: rgba(15, 15, 25, 0.9);
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          overflow-y: auto;
        }
        
        .filter-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .filter-section label {
          font-size: 0.75rem;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        
        .search-input {
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9rem;
        }
        
        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
        }
        
        .filter-select {
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9rem;
          cursor: pointer;
        }
        
        .filter-select option {
          background: #1a1a2e;
        }
        
        .type-legend {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .legend-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .legend-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        
        .legend-item.active {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        
        .legend-label {
          font-size: 0.85rem;
        }
        
        .view-toggle {
          display: flex;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 8px;
          overflow: hidden;
        }
        
        .view-toggle button {
          flex: 1;
          padding: 10px;
          background: transparent;
          border: none;
          color: #6b7280;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .view-toggle button.active {
          background: rgba(59, 130, 246, 0.3);
          color: #3b82f6;
        }
        
        .canvas-container {
          flex: 1;
          overflow: auto;
          position: relative;
        }
        
        .tree-view {
          padding: 20px;
          min-height: 100%;
        }
        
        .tree-node {
          user-select: none;
        }
        
        .node-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          margin: 4px 0;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          border-left: 3px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .node-row:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        
        .node-row.selected {
          background: rgba(59, 130, 246, 0.2);
          border-left-color: #3b82f6 !important;
        }
        
        .node-row.dimmed {
          opacity: 0.5;
        }
        
        .expand-btn {
          width: 20px;
          height: 20px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 4px;
          color: #9ca3af;
          font-size: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        
        .expand-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        
        .expand-placeholder {
          width: 20px;
          flex-shrink: 0;
        }
        
        .node-icon {
          font-size: 1rem;
          flex-shrink: 0;
        }
        
        .node-name {
          flex: 1;
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .type-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        }
        
        .child-count {
          font-size: 0.75rem;
          color: #6b7280;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          flex-shrink: 0;
        }
        
        .mindmap-container {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          cursor: grab;
        }
        
        .mindmap-container:active {
          cursor: grabbing;
        }
        
        .zoom-controls {
          position: absolute;
          top: 16px;
          right: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(15, 15, 25, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 8px 12px;
          z-index: 100;
        }
        
        .zoom-controls button {
          width: 28px;
          height: 28px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: #fff;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .zoom-controls button:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .zoom-controls span {
          font-size: 0.8rem;
          color: #9ca3af;
          min-width: 45px;
          text-align: center;
        }
        
        .zoom-controls .reset-btn {
          width: auto;
          padding: 0 12px;
          font-size: 0.75rem;
          margin-left: 4px;
        }
        
        .mindmap-view {
          position: absolute;
          min-width: 3000px;
          min-height: 2000px;
          transform-origin: 0 0;
        }
        
        .connection-svg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: visible;
        }
        
        .mindmap-node {
          position: absolute;
          width: 160px;
          background: rgba(15, 15, 25, 0.95);
          border: 2px solid #3b82f6;
          border-radius: 12px;
          overflow: hidden;
          cursor: grab;
          transition: box-shadow 0.2s;
          z-index: 1;
        }
        
        .mindmap-node:active {
          cursor: grabbing;
        }
        
        .mindmap-node.selected {
          box-shadow: 0 0 30px rgba(59, 130, 246, 0.6) !important;
          z-index: 10;
        }
        
        .mindmap-node-header {
          padding: 8px;
          text-align: center;
          font-size: 1.2rem;
        }
        
        .mindmap-node-body {
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .node-type-icon {
          flex-shrink: 0;
        }
        
        .mindmap-node-name {
          font-size: 0.8rem;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .mindmap-expand-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 4px;
          color: #9ca3af;
          padding: 4px 8px;
          font-size: 0.7rem;
          cursor: pointer;
          flex-shrink: 0;
        }
        
        .mindmap-expand-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        
        .details-panel {
          width: 320px;
          background: rgba(15, 15, 25, 0.95);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          overflow-y: auto;
        }
        
        .panel-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 0.9rem;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 2px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .detail-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .detail-label {
          font-size: 0.75rem;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .detail-value {
          font-size: 0.95rem;
          color: #e5e7eb;
          padding: 12px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          word-break: break-all;
        }
        
        .type-selector {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        
        .type-option {
          padding: 10px;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
        }
        
        .type-option:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        
        .type-option.selected {
          border-color: currentColor;
          background: rgba(255, 255, 255, 0.08);
        }
        
        .notes-textarea {
          width: 100%;
          min-height: 120px;
          padding: 14px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.85rem;
          resize: vertical;
        }
        
        .notes-textarea:focus {
          outline: none;
          border-color: #3b82f6;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 24px;
          color: #6b7280;
          text-align: center;
          padding: 40px;
        }
        
        .empty-icon {
          font-size: 4rem;
          opacity: 0.5;
        }
        
        .empty-text {
          font-size: 1.1rem;
          max-width: 400px;
          line-height: 1.6;
        }
        
        .no-results {
          padding: 40px;
          text-align: center;
          color: #6b7280;
        }
        
        .stats-bar {
          display: flex;
          gap: 20px;
          padding: 12px 20px;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          flex-wrap: wrap;
        }
        
        .stat-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: #9ca3af;
        }
        
        .stat-value {
          color: #fff;
          font-weight: 600;
        }
        
        input[type="file"] {
          display: none;
        }
        
        .clear-filter-btn {
          padding: 8px 12px;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 6px;
          color: #ef4444;
          font-size: 0.75rem;
          cursor: pointer;
          margin-top: 8px;
        }
        
        .clear-filter-btn:hover {
          background: rgba(239, 68, 68, 0.3);
        }
      `}</style>

      <header className="header">
        <div className="logo">
          <div className="logo-icon">🔬</div>
          <div>
            <div className="logo-text">FWMAP</div>
            <div className="logo-subtitle">Firmware Analysis Tool</div>
          </div>
        </div>
        
        <div className="toolbar">
          <input
            type="file"
            ref={fileInputRef}
            webkitdirectory=""
            directory=""
            onChange={handleFolderSelect}
          />
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            📂 Import Filesystem
          </button>
          
          <input
            type="file"
            ref={fmapInputRef}
            accept=".fmap"
            onChange={importFMAP}
          />
          <button className="btn" onClick={() => fmapInputRef.current?.click()}>
            📥 Import .FMAP
          </button>
          
          <button className="btn" onClick={exportFMAP} disabled={nodes.length === 0}>
            📤 Export .FMAP
          </button>
          
          {nodes.length > 0 && (
            <button className="btn btn-danger" onClick={() => {
              setNodes([]);
              setConnections([]);
              setNodePositions({});
              setSelectedNode(null);
              setExpandedNodes(new Set());
            }}>
              🗑️ Clear
            </button>
          )}
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="filter-section">
            <label>Search Files</label>
            <input
              type="text"
              className="search-input"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-section">
            <label>Filter by Type</label>
            <select 
              className="filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              {Object.entries(nodeTypes).map(([key, value]) => (
                <option key={key} value={key}>{value.icon} {value.label}</option>
              ))}
            </select>
            {(searchTerm || filterType !== 'all') && (
              <button 
                className="clear-filter-btn"
                onClick={() => { setSearchTerm(''); setFilterType('all'); }}
              >
                ✕ Clear Filters
              </button>
            )}
          </div>
          
          <div className="filter-section">
            <label>View Mode</label>
            <div className="view-toggle">
              <button 
                className={viewMode === 'tree' ? 'active' : ''}
                onClick={() => setViewMode('tree')}
              >
                🌲 Tree
              </button>
              <button 
                className={viewMode === 'mindmap' ? 'active' : ''}
                onClick={() => setViewMode('mindmap')}
              >
                🕸️ Mind Map
              </button>
            </div>
          </div>
          
          <div className="filter-section">
            <label>Type Legend</label>
            <div className="type-legend">
              {Object.entries(nodeTypes).map(([key, value]) => (
                <div 
                  key={key} 
                  className={`legend-item ${filterType === key ? 'active' : ''}`}
                  onClick={() => setFilterType(filterType === key ? 'all' : key)}
                >
                  <div className="legend-dot" style={{ backgroundColor: value.color }} />
                  <span className="legend-label">{value.icon} {value.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="canvas-container">
          {nodes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-text">
                Import a firmware filesystem to begin mapping.<br />
                Click <strong>Import Filesystem</strong> to select a folder,<br />
                or <strong>Import .FMAP</strong> to load a saved map.
              </div>
            </div>
          ) : viewMode === 'tree' ? (
            <div className="tree-view">
              {rootNodes.length > 0 ? (
                rootNodes.map(node => renderTreeNode(node, visibleTreeNodes))
              ) : (
                <div className="no-results">
                  No files match your search/filter criteria
                </div>
              )}
            </div>
          ) : (
            <div 
              className="mindmap-container"
              ref={mindmapContainerRef}
              onMouseDown={handlePanStart}
              onMouseMove={handlePanMove}
              onMouseUp={handlePanEnd}
              onMouseLeave={handlePanEnd}
              onWheel={handleWheel}
            >
              <div className="zoom-controls">
                <button onClick={() => setZoom(z => Math.min(z * 1.2, 3))}>+</button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.1))}>−</button>
                <button onClick={resetView} className="reset-btn">Reset</button>
              </div>
              <div 
                className="mindmap-view"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0'
                }}
              >
                {renderConnections(visibleMindmapNodes)}
                {visibleMindmapNodes.length > 0 ? (
                  visibleMindmapNodes.map(node => renderMindmapNode(node))
                ) : (
                  <div className="no-results">
                    No files match your search/filter criteria
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedNode && (
          <aside className="details-panel">
            <div className="panel-title">Node Details</div>
            
            <div className="detail-row">
              <span className="detail-label">Name</span>
              <div className="detail-value">{selectedNode.name}</div>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Type</span>
              <div className="detail-value">
                {selectedNode.type === 'folder' ? '📁 Directory' : '📄 File'}
              </div>
            </div>
            
            {selectedNode.size > 0 && (
              <div className="detail-row">
                <span className="detail-label">Size</span>
                <div className="detail-value">
                  {selectedNode.size > 1024 * 1024 
                    ? `${(selectedNode.size / 1024 / 1024).toFixed(2)} MB`
                    : selectedNode.size > 1024
                      ? `${(selectedNode.size / 1024).toFixed(2)} KB`
                      : `${selectedNode.size} bytes`
                  }
                </div>
              </div>
            )}
            
            <div className="detail-row">
              <span className="detail-label">Classification</span>
              <div className="type-selector">
                {Object.entries(nodeTypes).map(([key, value]) => (
                  <div
                    key={key}
                    className={`type-option ${selectedNode.nodeType === key ? 'selected' : ''}`}
                    style={{ color: value.color }}
                    onClick={() => updateNodeType(selectedNode.id, key)}
                  >
                    {value.icon} {value.label}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Analysis Notes</span>
              <textarea
                className="notes-textarea"
                placeholder="Add notes about this file/directory..."
                value={selectedNode.notes}
                onChange={(e) => updateNodeNotes(selectedNode.id, e.target.value)}
              />
            </div>
          </aside>
        )}
      </div>

      {nodes.length > 0 && (
        <div className="stats-bar">
          <div className="stat-item">
            <span>Total Items:</span>
            <span className="stat-value">{nodes.length}</span>
          </div>
          <div className="stat-item">
            <span>Directories:</span>
            <span className="stat-value">{nodes.filter(n => n.type === 'folder').length}</span>
          </div>
          <div className="stat-item">
            <span>Files:</span>
            <span className="stat-value">{nodes.filter(n => n.type === 'file').length}</span>
          </div>
          <div className="stat-item">
            <span>Classified:</span>
            <span className="stat-value">
              {nodes.filter(n => n.nodeType !== 'unknown').length}
            </span>
          </div>
          <div className="stat-item">
            <span>Visible:</span>
            <span className="stat-value">{viewMode === 'tree' ? visibleTreeNodes.length : visibleMindmapNodes.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FirmwareMapper;
