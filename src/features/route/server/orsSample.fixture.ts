// テスト用: OpenRouteService の応答サンプル
/** OpenRouteService の GeoJSON 応答(実物を小さくしたもの) */
export const ORS_SAMPLE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        summary: { distance: 201.6, duration: 145.2 },
        segments: [
          {
            distance: 201.6,
            duration: 145.2,
            steps: [
              { distance: 90.4, duration: 65, type: 11, instruction: "Head east", name: "-", way_points: [0, 1] },
              { distance: 111.2, duration: 80.2, type: 0, instruction: "Turn left", name: "-", way_points: [1, 2] },
              { distance: 0, duration: 0, type: 10, instruction: "Arrive", name: "-", way_points: [2, 2] },
            ],
          },
        ],
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [139.7, 35.7, 10],
          [139.701, 35.7, 11],
          [139.701, 35.701, 12],
        ],
      },
    },
  ],
};
