import type * as chart from "chart.js";

declare global {
  interface Window {
    basecoat: {
      init(componentName: string, options?: { force?: boolean }): void;
      chart<T extends chart.ChartType>(
        elementOrSelector: string | HTMLElement,
        config: {
          /**
           * Chart.js chart type.
           */
          type: T;
          /**
           * Row key used for labels.
           */
          labelKey: string;
          /**
           * Array of row objects, or raw Chart.js data with datasets.
           */
          data: any[];
          /**
           * Series config mapped from row keys.
           */
          series: Record<
            string,
            {
              /**
               * Display label for legends and tooltips.
               */
              label?: string;
              /**
               * Base color for the series stroke, fill, legend marker, and tooltip marker.
               */
              color?: string;
              /**
               * Derives a fill from color. Use true for a translucent fill, "gradient" for
               * an upstream-style vertical fade, or { from, to } for custom opacity stops.
               */
              surface?:
                | boolean
                | "gradient"
                | {
                    from: string;
                    to: string;
                  };
              /**
               * Raw Chart.js dataset options.
               */
              dataset?: chart.ChartTypeRegistry[T]["datasetOptions"];
            }
          >;
          /**
           * Generates a Basecoat legend after the canvas.
           */
          legend?: boolean;
          /**
           * Uses the Basecoat external tooltip.
           * @default true
           */
          tooltip?: boolean;
          /**
           * Raw Chart.js options.
           */
          options?: chart.ChartTypeRegistry[T]["chartOptions"];
          /**
           * Raw Chart.js plugins.
           */
          plugins?: chart.Plugin[];
          /**
           * Complete Chart.js data object. Overrides the data mapper.
           */
          chartData?: chart.ChartData;
        },
      ): void;
      theme: {
        /**
         * Returns "dark" or "light".
         */
        get(): "dark" | "light";
        /**
         * Sets the mode to "dark" or "light" and stores it in localStorage.themeMode.
         */
        set(theme: "dark" | "light"): void;
        /**
         * Toggles between dark and light mode.
         */
        toggle(): void;
      };
    };
  }

  interface HTMLElement {
    /**
     * Show a toad within a toaster.
     */
    toast(config: {
      duration?: number;
      category?: "success" | "error" | "warning" | "info";
      title: string;
      description?: string;
      action?: {
        label: string;
        href?: string;
        onclick?: () => void;
      };
      cancel?: {
        label: string;
        onclick?: () => void;
      };
    }): void;
    /**
     * Opens the menu or sidebar.
     */
    open(): void;
    /**
     * Closes the menu or sidebar.
     */
    close(): void;
    /**
     * Toggles the menu or sidebar.
     */
    toggle(): void;
    /**
     * Rescans menu items after children change inside the existing role="menu" element.
     */
    refresh(): void;
  }
}
