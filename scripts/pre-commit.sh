echo "Running lint-staged for React..."
(cd frontend && npx lint-staged) || exit 1

echo "Running Python linters..."
cd ./backend || exit 1
pre-commit run --config ../.pre-commit-config.yaml --all-files || exit 1
echo "Checking Rust code formatting..."
(cd ../frontend/src-tauri && cargo fmt )|| exit 1

echo "All linting checks passed."