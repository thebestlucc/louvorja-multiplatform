use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};

#[derive(Default, Clone)]
pub struct ConnectionCounter(pub Arc<AtomicUsize>);

impl ConnectionCounter {
    pub fn new() -> Self { Self(Arc::new(AtomicUsize::new(0))) }
    pub fn count(&self) -> usize { self.0.load(Ordering::SeqCst) }
    pub fn guard(&self) -> ConnGuard {
        self.0.fetch_add(1, Ordering::SeqCst);
        ConnGuard(self.0.clone())
    }
}

pub struct ConnGuard(Arc<AtomicUsize>);
impl Drop for ConnGuard {
    fn drop(&mut self) { self.0.fetch_sub(1, Ordering::SeqCst); }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn guard_increments_and_drop_decrements() {
        let c = ConnectionCounter::new();
        assert_eq!(c.count(), 0);
        { let _g = c.guard(); assert_eq!(c.count(), 1); }
        assert_eq!(c.count(), 0);
    }
    #[test]
    fn multiple_guards_accumulate() {
        let c = ConnectionCounter::new();
        let _g1 = c.guard(); let _g2 = c.guard(); let _g3 = c.guard();
        assert_eq!(c.count(), 3);
    }
}
