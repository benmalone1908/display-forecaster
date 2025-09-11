interface TooltipDimensions {
  width: number;
  height: number;
}

interface PositionResult {
  x: number;
  y: number;
  placement: 'right' | 'left' | 'top' | 'bottom';
}

/**
 * Calculates optimal tooltip position considering modal boundaries and viewport constraints
 */
export function calculateTooltipPosition(
  clickX: number,
  clickY: number,
  tooltipDimensions: TooltipDimensions = { width: 400, height: 300 }
): PositionResult {
  const padding = 15; // Minimum distance from edges
  const cursorOffset = 15; // Offset from cursor position
  
  // Find the closest modal dialog content
  const modalElements = [
    document.querySelector('[data-radix-dialog-content]'),
    document.querySelector('[role="dialog"]'),
    document.querySelector('.fixed[data-state="open"]'),
    document.querySelector('div[style*="pointer-events: auto"]') // Common modal pattern
  ].filter(Boolean);
  
  let containerRect: DOMRect;
  let isInModal = false;
  
  // Try to find the actual modal content container
  for (const modalElement of modalElements) {
    if (modalElement) {
      const rect = modalElement.getBoundingClientRect();
      // Check if the click is actually within this modal
      if (clickX >= rect.left && clickX <= rect.right && 
          clickY >= rect.top && clickY <= rect.bottom) {
        containerRect = rect;
        isInModal = true;
        console.log('Found modal container:', rect);
        break;
      }
    }
  }
  
  // Fallback to viewport if no modal found
  if (!isInModal) {
    containerRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    console.log('Using viewport container');
  }
  
  // Calculate available space in each direction from cursor
  const spaceRight = containerRect.right - clickX;
  const spaceLeft = clickX - containerRect.left;
  const spaceBelow = containerRect.bottom - clickY;
  const spaceAbove = clickY - containerRect.top;
  
  console.log('=== TOOLTIP POSITIONING DEBUG ===');
  console.log('Click position: X=' + clickX + ', Y=' + clickY);
  console.log('Container: left=' + containerRect.left + ', top=' + containerRect.top + ', right=' + containerRect.right + ', bottom=' + containerRect.bottom);
  console.log('Container size: ' + containerRect.width + 'x' + containerRect.height);
  console.log('Spaces: right=' + spaceRight + ', left=' + spaceLeft + ', below=' + spaceBelow + ', above=' + spaceAbove);
  console.log('Tooltip: ' + tooltipDimensions.width + 'x' + tooltipDimensions.height);
  console.log('Is in modal:', isInModal);
  
  let finalX = clickX;
  let finalY = clickY;
  let placement: 'right' | 'left' | 'top' | 'bottom' = 'right';
  
  // Determine horizontal position
  if (spaceRight >= tooltipDimensions.width + cursorOffset + padding) {
    // Place to the right of cursor
    finalX = clickX + cursorOffset;
    placement = 'right';
  } else if (spaceLeft >= tooltipDimensions.width + cursorOffset + padding) {
    // Place to the left of cursor
    finalX = clickX - cursorOffset - tooltipDimensions.width;
    placement = 'left';
  } else {
    // Not enough space on either side, place in the center of available space
    const availableWidth = containerRect.right - containerRect.left;
    if (availableWidth >= tooltipDimensions.width + (padding * 2)) {
      // Center horizontally in container
      finalX = containerRect.left + (availableWidth - tooltipDimensions.width) / 2;
    } else {
      // Container is too small, place at left edge with padding
      finalX = containerRect.left + padding;
      tooltipDimensions.width = availableWidth - (padding * 2); // Adjust width to fit
    }
    placement = spaceRight >= spaceLeft ? 'right' : 'left';
  }
  
  // Determine vertical position
  if (spaceBelow >= tooltipDimensions.height + cursorOffset + padding) {
    // Place below cursor
    finalY = clickY + cursorOffset;
  } else if (spaceAbove >= tooltipDimensions.height + cursorOffset + padding) {
    // Place above cursor
    finalY = clickY - cursorOffset - tooltipDimensions.height;
    placement = 'top';
  } else {
    // Not enough space above or below, center vertically in available space
    const availableHeight = containerRect.bottom - containerRect.top;
    if (availableHeight >= tooltipDimensions.height + (padding * 2)) {
      finalY = containerRect.top + (availableHeight - tooltipDimensions.height) / 2;
    } else {
      // Container is too small vertically, place at top with padding
      finalY = containerRect.top + padding;
      tooltipDimensions.height = availableHeight - (padding * 2); // Adjust height to fit
    }
    placement = 'bottom';
  }
  
  // Final bounds checking - ensure tooltip is fully within container
  finalX = Math.max(
    containerRect.left + padding,
    Math.min(finalX, containerRect.right - tooltipDimensions.width - padding)
  );
  finalY = Math.max(
    containerRect.top + padding,
    Math.min(finalY, containerRect.bottom - tooltipDimensions.height - padding)
  );
  
  console.log('Final position: X=' + finalX + ', Y=' + finalY + ', placement=' + placement);
  
  return {
    x: finalX,
    y: finalY,
    placement
  };
}

/**
 * Gets the appropriate z-index for tooltips based on context
 */
export function getTooltipZIndex(): string {
  // Check if we're inside a modal
  const modalElement = document.querySelector('[data-state="open"][role="dialog"]') ||
                      document.querySelector('.fixed[role="dialog"]') ||
                      document.querySelector('[data-radix-dialog-content]');
  
  if (modalElement) {
    // Higher z-index for modal tooltips
    return 'z-[100]';
  }
  
  // Standard z-index for regular tooltips
  return 'z-50';
}

/**
 * Checks if a tooltip should be repositioned due to container scroll
 */
export function shouldRepositionTooltip(
  originalClickX: number,
  originalClickY: number,
  containerElement?: Element | null
): boolean {
  if (!containerElement) return false;
  
  const rect = containerElement.getBoundingClientRect();
  const isClickVisible = originalClickX >= rect.left && originalClickX <= rect.right &&
                        originalClickY >= rect.top && originalClickY <= rect.bottom;
  
  return !isClickVisible;
}

/**
 * Creates a debounced scroll handler to hide tooltips when scrolling
 */
export function createScrollHandler(hideTooltip: () => void, delay: number = 150) {
  let timeoutId: NodeJS.Timeout;
  
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(hideTooltip, delay);
  };
}