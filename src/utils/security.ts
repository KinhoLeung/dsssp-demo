/**
 * src/utils/security.ts
 * 
 * 下位机上位机安全防护方案二：反调试与逻辑一致性校验
 */

const debugTrap = () => {
    try {
        // 直接触发 debugger（避免 CSP 拦截 unsafe-eval / new Function）
        // 注意：要让生产构建保留该语句，需要确保 terser 不启用 drop_debugger
        debugger;
    } catch (e) {
        // ignore
    }
};

/**
 * 启动反调试“炸弹”
 * 当开发者尝试打开 F12 时，debugger 陷阱会不断触发
 */
export const startAntiDebug = () => {
    // 仅在生产环境启用，避免干扰开发过程
    if (import.meta.env.DEV) return;

    // 定时触发断点陷阱
    setInterval(() => {
        debugTrap();
    }, 1000);

    // 额外的：检测控制台打开的分辨率变化防护（可选）
    // 以及动态修改代码的简单防护
};

/**
 * 校验函数是否被非法篡改（简单版本）
 * 通过检查函数体字符串中是否包含特定标记位来判断逻辑是否完整
 */
export const isTampered = (fn: Function, marker: string): boolean => {
    if (import.meta.env.DEV) return false;

    try {
        const fnStr = fn.toString();
        // 如果破解者直接重载了函数（例如 client.authVerify = () => true），marker 会消失
        return !fnStr.includes(marker);
    } catch {
        return true;
    }
};
