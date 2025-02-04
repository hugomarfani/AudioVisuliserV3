#include <openvino/genai/llm_pipeline.hpp>
#include <openvino/openvino.hpp>
#include <iostream>
#include <string>
#include <tuple>
#include <vector>

std::string getModelDevice()
{
    ov::Core core;

    std::vector<std::string> availableDevices = core.get_available_devices();

    // raise error if no devices are available
    if (availableDevices.empty())
    {
        throw std::runtime_error("No devices available");
    }

    for (const auto &device : availableDevices)
    {
        if (device.find("GPU") != std::string::npos)
        {
            return device;
        }
    }
    return availableDevices[0];
}

int main(int argc, char *argv[])
{
    std::string model_path = "./gemma-2-9b-it-int4-ov";
    std::string device = getModelDevice();
    ov::genai::LLMPipeline pipe(model_path, device);

    std::cout << pipe.generate("The Sun is yellow because", ov::genai::max_new_tokens(100));
}