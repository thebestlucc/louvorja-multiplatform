use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPoint {
    pub slide_index: usize,
    pub timestamp_ms: u64,
}

pub struct SyncTimeline {
    points: Vec<SyncPoint>,
}

impl SyncTimeline {
    pub fn new(mut points: Vec<SyncPoint>) -> Self {
        points.sort_by_key(|p| p.timestamp_ms);
        Self { points }
    }

    pub fn slide_at(&self, position_ms: u64) -> usize {
        let mut slide = 0;
        for point in &self.points {
            if position_ms >= point.timestamp_ms {
                slide = point.slide_index;
            } else {
                break;
            }
        }
        slide
    }

    pub fn add_point(&mut self, point: SyncPoint) {
        self.points.push(point);
        self.points.sort_by_key(|p| p.timestamp_ms);
    }

    pub fn remove_point(&mut self, index: usize) {
        if index < self.points.len() {
            self.points.remove(index);
        }
    }

    pub fn update_point(&mut self, index: usize, timestamp_ms: u64) {
        if let Some(point) = self.points.get_mut(index) {
            point.timestamp_ms = timestamp_ms;
        }
        self.points.sort_by_key(|p| p.timestamp_ms);
    }

    pub fn to_vec(&self) -> Vec<SyncPoint> {
        self.points.clone()
    }
}
