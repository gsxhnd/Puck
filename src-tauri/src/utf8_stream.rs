//! Incremental UTF-8 decoder for chunked terminal I/O.
//!
//! 终端读循环按固定大小分块读取字节，可能在多字节 UTF-8 字符中间切断。
//! 本模块在块之间保留不完整尾字节，避免 `from_utf8_lossy` 永久插入 U+FFFD。

/// Buffers incomplete UTF-8 sequences across chunked reads.
///
/// 在分块读取之间缓存未完成的 UTF-8 尾字节。
pub struct Utf8StreamDecoder {
    pending: Vec<u8>,
}

impl Utf8StreamDecoder {
    pub fn new() -> Self {
        Self {
            pending: Vec::new(),
        }
    }

    /// Append a chunk and return newly completed UTF-8 text (may be empty).
    ///
    /// 追加一块原始字节，返回已完整的 UTF-8 文本（可能为空字符串）。
    pub fn push(&mut self, chunk: &[u8]) -> String {
        if chunk.is_empty() {
            return String::new();
        }
        self.pending.extend_from_slice(chunk);

        let mut output = String::new();
        loop {
            if self.pending.is_empty() {
                break;
            }
            match std::str::from_utf8(&self.pending) {
                Ok(text) => {
                    output.push_str(text);
                    self.pending.clear();
                    break;
                }
                Err(error) => {
                    let valid = error.valid_up_to();
                    if valid > 0 {
                        // SAFETY: `valid_up_to` guarantees `pending[..valid]` is valid UTF-8.
                        output.push_str(unsafe { std::str::from_utf8_unchecked(&self.pending[..valid]) });
                        self.pending.drain(..valid);
                        if error.error_len().is_none() {
                            break;
                        }
                    } else if error.error_len().is_some() {
                        output.push('\u{FFFD}');
                        self.pending.remove(0);
                    } else {
                        break;
                    }
                }
            }
        }
        output
    }

    /// Flush any remaining bytes at end-of-stream.
    ///
    /// 在流结束时刷出剩余字节（尾部残缺序列使用 lossy 解码）。
    pub fn finish(&mut self) -> String {
        if self.pending.is_empty() {
            return String::new();
        }
        String::from_utf8_lossy(&std::mem::take(&mut self.pending)).into_owned()
    }
}

impl Default for Utf8StreamDecoder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::Utf8StreamDecoder;

    #[test]
    fn reassembles_multibyte_character_split_across_chunks() {
        let chinese = "中文";
        let bytes = chinese.as_bytes();

        let mut decoder = Utf8StreamDecoder::new();
        assert_eq!(decoder.push(&bytes[..2]), "");
        assert_eq!(decoder.push(&bytes[2..]), chinese);
        assert_eq!(decoder.finish(), "");
    }

    #[test]
    fn emits_complete_prefix_before_incomplete_suffix() {
        let mut decoder = Utf8StreamDecoder::new();
        let bytes = "a中文".as_bytes();
        assert_eq!(decoder.push(&bytes[..2]), "a");
        assert_eq!(decoder.push(&bytes[2..]), "中文");
    }
}
