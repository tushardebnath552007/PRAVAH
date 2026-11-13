export type VisionTabType =
  | 'road_vision'
  | 'adas_safety'
  | 'road_conditions'
  | 'stability_analytics';

export interface VisionTabItem {
  id: VisionTabType;
  label: string;
  hint: string;
}
