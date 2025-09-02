// Toast.ts - Centralized toast notification system

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  type?: ToastType;
  duration?: number; // in milliseconds, 0 means no auto-dismiss
  icon?: string;
  title?: string;
}

interface ToastMessage {
  id: string;
  message: string;
  options: Required<ToastOptions>;
  element: HTMLDivElement;
  timeoutId?: number;
}

export class Toast {
  private static instance: Toast | null = null;
  private container: HTMLDivElement | null = null;
  private messages: Map<string, ToastMessage> = new Map();
  private nextId: number = 1;

  private constructor() {
    this.createContainer();
  }

  static getInstance(): Toast {
    if (!Toast.instance) {
      Toast.instance = new Toast();
    }
    return Toast.instance;
  }

  private createContainer(): void {
    this.container = document.createElement("div");
    this.container.id = "toast-container";
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    document.body.appendChild(this.container);
  }

  private getDefaultOptions(type: ToastType): Required<ToastOptions> {
    const defaults: Record<ToastType, Required<ToastOptions>> = {
      info: {
        type: "info",
        duration: 4000,
        icon: "ℹ️",
        title: "Info",
      },
      success: {
        type: "success",
        duration: 3000,
        icon: "✅",
        title: "Success",
      },
      warning: {
        type: "warning",
        duration: 5000,
        icon: "⚠️",
        title: "Warning",
      },
      error: {
        type: "error",
        duration: 0, // Errors don't auto-dismiss
        icon: "❌",
        title: "Error",
      },
    };
    return defaults[type];
  }

  private getToastStyles(type: ToastType): string {
    const baseStyles = `
      pointer-events: auto;
      margin-bottom: 12px;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      max-width: 400px;
      word-wrap: break-word;
      animation: slideInRight 0.3s ease-out;
      position: relative;
      cursor: pointer;
      transition: transform 0.2s ease, opacity 0.2s ease;
    `;

    const typeStyles: Record<ToastType, string> = {
      info: `
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9));
        color: white;
      `,
      success: `
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9));
        color: white;
      `,
      warning: `
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9));
        color: white;
      `,
      error: `
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9));
        color: white;
      `,
    };

    return baseStyles + typeStyles[type];
  }

  private createToastElement(
    message: string,
    options: Required<ToastOptions>
  ): HTMLDivElement {
    const toast = document.createElement("div");
    toast.style.cssText = this.getToastStyles(options.type);

    // Add hover effects
    toast.addEventListener("mouseenter", () => {
      toast.style.transform = "translateX(-4px) scale(1.02)";
    });
    toast.addEventListener("mouseleave", () => {
      toast.style.transform = "translateX(0) scale(1)";
    });

    // Create content
    const content = document.createElement("div");
    content.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 12px;
    `;

    // Icon
    const iconDiv = document.createElement("div");
    iconDiv.textContent = options.icon;
    iconDiv.style.cssText = `
      font-size: 20px;
      flex-shrink: 0;
      margin-top: 2px;
    `;

    // Text content
    const textDiv = document.createElement("div");
    textDiv.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    // Title
    const titleDiv = document.createElement("div");
    titleDiv.textContent = options.title;
    titleDiv.style.cssText = `
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    `;

    // Message
    const messageDiv = document.createElement("div");
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      font-size: 13px;
      line-height: 1.4;
      opacity: 0.95;
    `;

    // Close button for errors (since they don't auto-dismiss)
    if (options.type === "error") {
      const closeBtn = document.createElement("button");
      closeBtn.innerHTML = "×";
      closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      `;
      closeBtn.addEventListener("mouseenter", () => {
        closeBtn.style.opacity = "1";
        closeBtn.style.background = "rgba(255, 255, 255, 0.1)";
      });
      closeBtn.addEventListener("mouseleave", () => {
        closeBtn.style.opacity = "0.7";
        closeBtn.style.background = "none";
      });

      toast.appendChild(closeBtn);

      // Add right padding to make room for close button
      textDiv.style.paddingRight = "24px";
    }

    textDiv.appendChild(titleDiv);
    textDiv.appendChild(messageDiv);
    content.appendChild(iconDiv);
    content.appendChild(textDiv);
    toast.appendChild(content);

    return toast;
  }

  show(message: string, options: Partial<ToastOptions> = {}): string {
    if (!this.container) {
      this.createContainer();
    }

    const type = options.type || "info";
    const fullOptions = { ...this.getDefaultOptions(type), ...options };
    const id = `toast-${this.nextId++}`;

    const element = this.createToastElement(message, fullOptions);

    // Add click to dismiss
    element.addEventListener("click", () => {
      this.dismiss(id);
    });

    const toastMessage: ToastMessage = {
      id,
      message,
      options: fullOptions,
      element,
    };

    // Auto-dismiss if duration > 0
    if (fullOptions.duration > 0) {
      toastMessage.timeoutId = window.setTimeout(() => {
        this.dismiss(id);
      }, fullOptions.duration);
    }

    this.messages.set(id, toastMessage);
    this.container!.appendChild(element);

    return id;
  }

  dismiss(id: string): void {
    const toast = this.messages.get(id);
    if (!toast) return;

    // Clear timeout if exists
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }

    // Animate out
    toast.element.style.animation = "slideOutRight 0.3s ease-in forwards";

    setTimeout(() => {
      if (toast.element.parentNode) {
        toast.element.parentNode.removeChild(toast.element);
      }
      this.messages.delete(id);
    }, 300);
  }

  // Convenience methods
  info(message: string, options: Partial<ToastOptions> = {}): string {
    return this.show(message, { ...options, type: "info" });
  }

  success(message: string, options: Partial<ToastOptions> = {}): string {
    return this.show(message, { ...options, type: "success" });
  }

  warning(message: string, options: Partial<ToastOptions> = {}): string {
    return this.show(message, { ...options, type: "warning" });
  }

  error(message: string, options: Partial<ToastOptions> = {}): string {
    return this.show(message, { ...options, type: "error" });
  }

  // Clear all toasts
  clear(): void {
    this.messages.forEach((_, id) => this.dismiss(id));
  }
}

// Add CSS animations to document
const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Export singleton instance for convenience
export const toast = Toast.getInstance();
