fn main() {
    // Load .env file from the project root or current directory
    let _ = dotenvy::dotenv();

    // Export specific variables to the compiler so they are available via env!()
    let vars = [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "MICROSOFT_CLIENT_ID",
        "MICROSOFT_CLIENT_SECRET",
    ];

    for var in vars {
        if let Ok(val) = std::env::var(var) {
            println!("cargo:rustc-env={}={}", var, val);
        }
    }

    tauri_build::build()
}
