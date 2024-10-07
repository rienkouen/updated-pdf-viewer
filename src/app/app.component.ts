import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  @ViewChild('pdfContainer', { static: true }) pdfContainer!: ElementRef<HTMLDivElement>;

  pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  pdfScale = 0.45;
  debugInfo = '';
  error = '';
  showFirstPage = true;
  showMiddlePages = true;
  showLastPage = true;
  firstPagePosition = '';
  middlePagesPosition = '';
  lastPagePosition = '';
  pdfWidth: number = 0;
  pdfHeight: number = 0;
  pdfWidthPt: number = 0;
  pdfHeightPt: number = 0;
  pointsToCmFactor: number = 0;
  containerWidth = '100%';
  containerHeight = '450px';

  ngOnInit() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdfjs/build/pdf.worker.min.js';
  }

  async loadPdf(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file && file.type === "application/pdf") {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        const result = e.target?.result;
        if (result instanceof ArrayBuffer) {
          await this.renderPdf(result);
        } else {
          this.error = 'Failed to read file as ArrayBuffer';
        }
      };
      fileReader.readAsArrayBuffer(file);
    } else {
      this.error = 'Please select a valid PDF file.';
    }
  }
  
  async renderPdf(data: ArrayBuffer) {
    this.debugInfo = 'Loading PDF...';
    try {
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      this.pdfDoc = pdf;
      
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      this.pdfWidthPt = viewport.width;
      this.pdfHeightPt = viewport.height;
  
      const POINTS_PER_INCH = 72;
      const CM_PER_INCH = 2.54;
      this.pointsToCmFactor = CM_PER_INCH / POINTS_PER_INCH;
      this.pdfWidth = this.pdfWidthPt * this.pointsToCmFactor;
      this.pdfHeight = this.pdfHeightPt * this.pointsToCmFactor;
  
      this.debugInfo += `\nPDF loaded successfully. Number of pages: ${pdf.numPages}`;
      this.debugInfo += `\nPDF dimensions: ${this.pdfWidth.toFixed(1)}cm x ${this.pdfHeight.toFixed(1)}cm`;
      
      await this.renderPages();
    } catch (error) {
      this.error = `Error loading PDF: ${(error as Error).message}`;
      this.debugInfo += `\nError loading PDF: ${(error as Error).message}`;
    }
  }

  async renderPages() {
    if (!this.pdfContainer || !this.pdfDoc) {
      this.error = 'PDF container not found or no PDF document loaded';
      return;
    }
    this.pdfContainer.nativeElement.innerHTML = '';
    
    const horizontalContainer = document.createElement('div');
    horizontalContainer.style.display = 'flex';
    horizontalContainer.style.overflowX = 'auto';
    horizontalContainer.style.width = this.containerWidth;
    horizontalContainer.style.height = this.containerHeight;
    
    this.pdfContainer.nativeElement.appendChild(horizontalContainer);

    const totalPages = this.pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      await this.renderPage(pageNum, horizontalContainer);
    }
  }
  
  async renderPage(num: number, container: HTMLElement): Promise<void> {
    if (!this.pdfDoc) {
      this.error = 'No PDF document loaded';
      return;
    }
    this.debugInfo += `\nRendering page ${num}`;
    try {
      const page = await this.pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale: this.pdfScale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error(`Failed to get 2D context for page ${num}`);
      }
      canvas.height = viewport.height;
      canvas.width = viewport.width;
  
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
  
      const pageDiv = document.createElement('div');
      pageDiv.className = 'page';
      pageDiv.style.width = `${viewport.width}px`;
      pageDiv.style.height = `${viewport.height}px`;
      pageDiv.style.position = 'relative';
      pageDiv.style.margin = '0 10px 10px 0';
      pageDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
      pageDiv.style.border = '1px solid black';
      pageDiv.style.boxSizing = 'border-box';
      pageDiv.style.padding = '2px';
  
      const canvasWrapper = document.createElement('div');
      canvasWrapper.style.width = '100%';
      canvasWrapper.style.height = '100%';
      canvasWrapper.style.overflow = 'hidden';
      canvasWrapper.appendChild(canvas);
      pageDiv.appendChild(canvasWrapper);
    
      const pageNumberDiv = document.createElement('div');
      pageNumberDiv.textContent = `Page ${num}`;
      pageNumberDiv.style.textAlign = 'center';
      pageNumberDiv.style.marginTop = '5px';
  
      pageDiv.appendChild(pageNumberDiv);
      container.appendChild(pageDiv);
  
      await page.render(renderContext).promise;
      this.debugInfo += `\nPage ${num} rendered successfully`;
      this.addQrPlaceholder(pageDiv, num);
    } catch (error) {
      this.error = `Error rendering page ${num}: ${(error as Error).message}`;
      this.debugInfo += `\nError rendering page ${num}: ${(error as Error).message}`;
    }
  }

  setContainerSize(width: string, height: string) {
    this.containerWidth = width;
    this.containerHeight = height;
    this.updateContainerSize();
  }
  
  updateContainerSize() {
    if (this.pdfContainer) {
      const container = this.pdfContainer.nativeElement.firstChild as HTMLElement;
      if (container) {
        container.style.width = this.containerWidth;
        container.style.height = this.containerHeight;
      }
    }
  }

  changeContainerAndRerender(width: string, height: string) {
    this.setContainerSize(width, height);
    if (this.pdfDoc) {
      this.renderPages();
    }
  }

  addQrPlaceholder(pageDiv: HTMLElement, pageNum: number) {
    const qrPlaceholder = document.createElement('div');
    qrPlaceholder.className = 'qr-placeholder';
    const initialSize = Math.max(this.cmToPx(2), 100);
    qrPlaceholder.style.width = `${initialSize}px`;
    qrPlaceholder.style.height = `${initialSize}px`;
    qrPlaceholder.style.position = 'absolute';
    qrPlaceholder.style.backgroundColor = 'rgba(200, 200, 200, 0.5)';
    qrPlaceholder.style.border = '2px dashed #666';
    qrPlaceholder.style.display = 'flex';
    qrPlaceholder.style.justifyContent = 'center';
    qrPlaceholder.style.alignItems = 'center';
    qrPlaceholder.innerHTML = 'QR';
  
    const left = 20;
    const top = 20;
    qrPlaceholder.style.left = `${left}px`;
    qrPlaceholder.style.top = `${top}px`;
  
    pageDiv.appendChild(qrPlaceholder);
  
    this.setupDraggable(qrPlaceholder, pageDiv, pageNum);
    this.setupResizable(qrPlaceholder, pageDiv, pageNum);
  
    this.updateQrPlaceholderVisibility(qrPlaceholder, pageNum);
    
    this.updatePositions();
  }

  setupDraggable(element: HTMLElement, container: HTMLElement, pageNum: number) {
    let isDragging = false;
    let startX: number, startY: number;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      startX = e.clientX - element.offsetLeft;
      startY = e.clientY - element.offsetTop;
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
  
      let newX = e.clientX - startX;
      let newY = e.clientY - startY;
  
      newX = Math.max(0, Math.min(newX, container.clientWidth - element.offsetWidth - 2));
      newY = Math.max(0, Math.min(newY, container.clientHeight - element.offsetHeight - 2));
  
      element.style.left = `${newX}px`;
      element.style.top = `${newY}px`;
  
      this.updatePositions();
      if (this.pdfDoc && pageNum > 1 && pageNum < this.pdfDoc.numPages) {
        this.updateAllMiddleQrPlaceholders(parseInt(element.style.width), newX, newY);
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    element.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  setupResizable(element: HTMLElement, container: HTMLElement, pageNum: number) {
    const resizer = document.createElement('div');
    resizer.className = 'resizer';
    resizer.style.width = '10px';
    resizer.style.height = '10px';
    resizer.style.background = 'blue';
    resizer.style.position = 'absolute';
    resizer.style.right = '0';
    resizer.style.bottom = '0';
    resizer.style.cursor = 'se-resize';
  
    element.appendChild(resizer);
  
    let isResizing = false;
    let originalWidth: number, originalHeight: number;
    let originalX: number, originalY: number;
    let originalLeft: number, originalTop: number;
  
    const onMouseDown = (e: MouseEvent) => {
      isResizing = true;
      originalWidth = element.offsetWidth;
      originalHeight = element.offsetHeight;
      originalX = e.clientX;
      originalY = e.clientY;
      originalLeft = element.offsetLeft;
      originalTop = element.offsetTop;
      e.preventDefault();
    };
  
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
    
      const deltaX = e.clientX - originalX;
      const deltaY = e.clientY - originalY;
    
      const minSizePx = this.cmToPx(2);
      const newSize = Math.max(originalWidth + deltaX, originalHeight + deltaY, minSizePx);
    
      const maxSize = Math.min(
        container.clientWidth - originalLeft - 2,
        container.clientHeight - originalTop - 2
      );
    
      const finalSize = Math.min(newSize, maxSize);
    
      element.style.width = `${finalSize}px`;
      element.style.height = `${finalSize}px`;
    
      const newLeft = Math.max(0, Math.min(originalLeft, container.clientWidth - finalSize - 2));
      const newTop = Math.max(0, Math.min(originalTop, container.clientHeight - finalSize - 2));
      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
    
      this.updatePositions();
      if (this.pdfDoc && pageNum > 1 && pageNum < this.pdfDoc.numPages) {
        this.updateAllMiddleQrPlaceholders(finalSize, newLeft, newTop);
      }
    };
  
    const onMouseUp = () => {
      isResizing = false;
    };
  
    resizer.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  updateQrPlaceholderVisibility(element: HTMLElement, pageNum: number) {
    if (!this.pdfDoc) return;
    let isVisible = false;
    if (pageNum === 1) {
      isVisible = this.showFirstPage;
    } else if (pageNum === this.pdfDoc.numPages) {
      isVisible = this.showLastPage;
    } else {
      isVisible = this.showMiddlePages;
    }
    element.style.display = isVisible ? 'flex' : 'none';
    this.updatePositionDisplay();
  }
  
  updatePositionDisplay() {
    if (!this.pdfDoc) return;
  
    const pages = document.querySelectorAll('.page');
    const totalPages = pages.length;
  
    this.firstPagePosition = '';
    this.lastPagePosition = '';
    this.middlePagesPosition = '';
  
    pages.forEach((page, index) => {
      const qrPlaceholder = page.querySelector('.qr-placeholder') as HTMLElement | null;
      if (qrPlaceholder && qrPlaceholder.style.display !== 'none') {
        const pageHeight = page.clientHeight;
        const left = Math.max(0, qrPlaceholder.offsetLeft);
        const bottom = Math.max(0, pageHeight - (qrPlaceholder.offsetTop + qrPlaceholder.offsetHeight));
        const width = qrPlaceholder.offsetWidth;
        
        const position = `${this.pxToCm(left)} cm, ${this.pxToCm(bottom)} cm, ${this.pxToCm(width)} cm`;
        if (index === 0 && this.showFirstPage) {
          this.firstPagePosition = position;
        } else if (index === totalPages - 1 && this.showLastPage) {
          this.lastPagePosition = position;
        } else if (index > 0 && index < totalPages - 1 && this.showMiddlePages) {
          this.middlePagesPosition = position;
        }
      }
    });
  }

  updatePositions() {
    const pages = document.querySelectorAll('.page');
    pages.forEach((page, index) => {
      const qrPlaceholder = page.querySelector('.qr-placeholder') as HTMLElement | null;
      if (qrPlaceholder) {
        const pageHeight = page.clientHeight;
        const left = Math.max(0, qrPlaceholder.offsetLeft);
        const bottom = Math.max(0, pageHeight - (qrPlaceholder.offsetTop + qrPlaceholder.offsetHeight));
        const width = qrPlaceholder.offsetWidth;
        
        const position = `${this.pxToCm(left).toFixed(1)} cm, ${this.pxToCm(bottom).toFixed(1)} cm, ${this.pxToCm(width).toFixed(1)} cm`;
        
        if (index === 0) {
          this.firstPagePosition = position;
        } else if (index === pages.length - 1) {
          this.lastPagePosition = position;
        } else {
          this.middlePagesPosition = position;
        }
      }
    });
  }

  private updateAllMiddleQrPlaceholders(size: number, left: number, top: number) {
    const placeholders = document.querySelectorAll('.page:not(:first-child):not(:last-child) .qr-placeholder');
    placeholders.forEach((placeholder: Element) => {
      if (placeholder instanceof HTMLElement) {
        placeholder.style.width = `${size}px`;
        placeholder.style.height = `${size}px`;
        placeholder.style.left = `${left}px`;
        placeholder.style.top = `${top}px`;
      }
    });
  }

  pxToCm(px: number): number {
    const points = px / this.pdfScale;
    return Number((points * this.pointsToCmFactor).toFixed(1));
  }
  
  cmToPx(cm: number): number {
    const points = cm / this.pointsToCmFactor;
    return Math.round(points * this.pdfScale);
  }

  onShowFirstPageChange() {
    this.updateAllQrPlaceholderVisibility();
    this.updatePositionDisplay();
  }
  
  onShowMiddlePagesChange() {
    this.updateAllQrPlaceholderVisibility();
    this.updatePositionDisplay();
  }
  
  onShowLastPageChange() {
    this.updateAllQrPlaceholderVisibility();
    this.updatePositionDisplay();
  }
  
  updateAllQrPlaceholderVisibility() {
    const pages = document.querySelectorAll('.page');
    pages.forEach((page, index) => {
      const qrPlaceholder = page.querySelector('.qr-placeholder') as HTMLElement | null;
      if (qrPlaceholder) {
        this.updateQrPlaceholderVisibility(qrPlaceholder, index + 1);
      }
    });
  }
}