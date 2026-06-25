use std::sync::OnceLock;

use tokio::runtime::Runtime;

pub fn runtime() -> &'static Runtime {
    static RUNTIME: OnceLock<Runtime> = OnceLock::new();
    RUNTIME.get_or_init(|| {
        Runtime::new().expect("failed to create tokio runtime")
    })
}

pub fn block_on<F: std::future::Future>(future: F) -> F::Output {
    runtime().block_on(future)
}
