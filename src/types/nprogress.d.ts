declare module "nprogress" {
  export type NProgressOptions = {
    minimum?: number;
    easing?: string;
    speed?: number;
    trickle?: boolean;
    trickleSpeed?: number;
    showSpinner?: boolean;
  };

  export interface NProgressStatic {
    status: number | null;
    configure(options: NProgressOptions): NProgressStatic;
    set(n: number): NProgressStatic;
    start(): NProgressStatic;
    done(force?: boolean): NProgressStatic;
  }

  const NProgress: NProgressStatic;
  export default NProgress;
}
