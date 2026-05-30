#!/bin/bash

# 批量转换视频脚本
# 参数：720p/30fps/无声，重复文件名加序号

SOURCE_DIR="/Users/miko/Movies/电龙视频剪辑"
TARGET_DIR="/Users/miko/Code/web-behavior-tree/public/ActionMP4"

# 清空目标目录
rm -rf "$TARGET_DIR"/*
mkdir -p "$TARGET_DIR"

# 声明关联数组记录计数
declare -A name_count

# 获取所有源文件并排序处理
find "$SOURCE_DIR" -name "*.mp4" -type f | sort | while read -r src_file; do
    # 获取基础文件名（不含扩展名）
    base=$(basename "$src_file" .mp4)

    # 计数加1
    count=${name_count[$base]:-0}
    count=$((count + 1))
    name_count[$base]=$count

    # 生成输出文件名
    if [ $count -eq 1 ]; then
        out_name="${base}.mp4"
    else
        out_name="${base}-${count}.mp4"
    fi

    out_path="$TARGET_DIR/$out_name"

    echo "[$count] 转换: $out_name"
    ffmpeg -i "$src_file" -vf "fps=30,scale=720:-2:flags=lanczos" -an -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 "$out_path" -y 2>&1 | tail -2
done

echo "转换完成！"
ls -1 "$TARGET_DIR"/*.mp4 2>/dev/null | wc -l
echo "个视频文件"
